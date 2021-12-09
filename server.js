require('dotenv').config({ path: './sample.env' });
const express = require('express');
const cors = require('cors');
const app = express();
const dns = require('dns');
const { json } = require('body-parser');
const mongoose = require('mongoose');
const { doesNotMatch } = require('assert');
const { Schema } = mongoose;

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Mongoose Requirements & Configuration
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
});
const shortURLSchema = new Schema({
  original_url: { type: String, unique: true },
  short_url: { type: Number, unique: true },
});
const UrlEntry = mongoose.model('UrlEntry', shortURLSchema);

// Methods for creating and finding shortened URL entries on the database
const newUrlId = () => {
  let maxShort = UrlEntry.find({})
    .sort({ short_url: -1 })
    .limit(1)
    .exec((err, urlEntry) => {
      return urlEntry.short_url;
    });
  return maxShort + 1;
};
const createUrlEntry = (url, shortUrl, done) => {
  let entry = new UrlEntry({
    original_url: url.href,
    short_url: shortUrl,
  });
  entry.save((err, urlEntry) => {
    if (err) return done(err);
    done(null, urlEntry);
  });
};
const findUrlEntry = (url, shortUrl = null, done) => {
  if (shortUrl == null) {
    UrlEntry.findOne({ original_url: url.href }, (err, urlEntry) => {
      if (err) return done(err);
      done(null, urlEntry);
    });
  } else {
    UrlEntry.findOne({ short_url: shortUrl }, (err, urlEntry) => {
      if (err) return done(err);
      done(null, urlEntry);
    });
  }
};

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
    if (err) {
      res.json({ error: 'invalid url' });
    } else {
      // Return true if there are no previous entries, and then create one
      if (
        findUrlEntry(fullURL, null, (err, urlEntry) => (err ? true : false))
      ) {
        console.log('No previous entries found, adding entry.');
        createUrlEntry(fullURL, newUrlId(), (err, urlEntry) => {
          if (err) return console.log(err);
          console.log(urlEntry);
          res.json(urlEntry);
        });
        // If there is a previous entry, display it.
      } else if (
        findUrlEntry(fullURL, null, (err, urlEntry) => (err ? false : true))
      ) {
        console.log('Previous entry found. Displaying...');
        findUrlEntry(fullURL, null, (err, urlEntry) => {
          if (err) return console.log(err);
          console.log(urlEntry);
          res.json(urlEntry);
        });
      }
      console.log(
        'Input URL: "' +
          fullURL.href +
          '", Total URL Entries: ' +
          UrlEntry.find({})
            .sort({ short_url: -1 })
            .exec((err, urlEntries) => {
              if (err) return console.log(err);
              return urlEntries.length;
            })
      );
    }
  });
});

// Use unique shorturl ids to redirect to the full-length URLs that they correspond to
app.get('/api/shorturl/:shortURL', (req, res) => {
  const shortURL = parseInt(req.params.shortURL);
  const originalURL = findUrlEntry(null, shortURL, (err, urlEntry) => {
    if (err) return console.log(err);
    console.log(urlEntry);
    return urlEntry.original_url;
  });
  try {
    console.log(
      `original_url was found, sending: "${originalURL}" as redirect path.`
    );
    res.status(301).redirect(originalURL);
    return;
  } catch (e) {
    console.log(e.message);
    console.log('original_url was not found, sending error JSON instead.');
    res.json({ error: 'invalid url' });
    return;
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
