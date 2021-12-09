require('dotenv').config({ path: './sample.env' });
const express = require('express');
const cors = require('cors');
const app = express();
const dns = require('dns');
const { json } = require('body-parser');
const mongoose = require('mongoose');
const { doesNotMatch } = require('assert');
const { Schema } = mongoose;

// Mongoose Requirements & Configuration
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true
});
const shortURLSchema = new Schema({
  original_url: { type: String, unique: true },
  short_url: { type: Number, unique: true }
});
const UrlEntry = mongoose.model('UrlEntry', shortURLSchema);


// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Methods for creating and finding shortened URL entries on the database
const newUrlId = () => {
  let maxShort = 1;
  return maxShort + 1;
};
const createUrlEntry = (url, shortUrl, done) => {
  let entry = new UrlEntry({
    original_url: url,
    short_url: shortUrl
  });
  entry.save((err, urlEntry) => {
    if (err) return done(err);
    done(null, urlEntry);
  });
}
const findUrlEntry = (url, shortUrl = null, done) => {
  if (shortUrl == null) {
    UrlEntry.findOne({ original_url: url }, (err, urlEntry) => {
      if (err) return done(err);
      done(null, urlEntry);
    });
  } else {
    UrlEntry.findOne({ short_url: shortUrl }, (err, urlEntry) => {
      if (err) return done(err);
      done(null, urlEntry);
    });
  }
}

// Register input URLs to unique ids and display their array entries.
app.post('/api/shorturl/', (req, res) => {
  let fullURL;
  try {
    fullURL = new URL(req.body.url);
  } catch (e) {
    console.log('Error: ' + e.message);
    res.json({ error: 'invalid url' });
    return;
  }
  if (fullURL.protocol == 'ftp:') {
    res.json({ error: 'invalid url' });
    return;
  }
  const options = {
    family: 0,
  };
  console.log(fullURL ? 'URL Exists' : 'No URL');
  dns.lookup(fullURL.hostname, options, (err) => {
    if (err || !fullURL) {
      res.json({ error: 'invalid url' });
    } else {
      if (testMatches(fullURL).length == 0) {
        console.log('No previous entries found, adding entry.');
        urlArr.push(makeEntry(urlArr.length, fullURL.href));
        res.json(makeEntry(urlArr.length - 1, fullURL.href));
      } else if (testMatches(fullURL).length > 0) {
        console.log('Previous entry found. Displaying...');
        const previousEntryIndex = testMatches(fullURL)[0].short_url;
        res.json(urlArr[previousEntryIndex]);
      } else {
        console.log('Invalid URL.');
        res.json({ error: 'invalid url' });
      }
      console.log(
        'Input URL: "' + fullURL.href + '", URL array length: ' + urlArr.length
      );
    }
  });
});

// Use unique shorturl ids to redirect to the full-length URLs that they correspond to
app.get('/api/shorturl/:shortURL?', (req, res) => {
  const shortURL = parseInt(req.params.shortURL);
  const originalURLEntry = urlArr.filter((entry) => {
    return entry.short_url == shortURL ? true : false;
  });
  const redirPath = originalURLEntry.length
    ? originalURLEntry[0].original_url
    : null;
  if (redirPath) {
    console.log(`original_url was found, sending: "${redirPath}" as redirect path.`);
    res.status(301).redirect(redirPath);
  } else {
    console.log('original_url was not found, sending error JSON instead.');
    res.json({ error: 'invalid url' });
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
