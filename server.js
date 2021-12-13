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
app.use(express.json());
app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Mongoose Requirements & Configuration
// Open the connection to the db
try {
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
  });
  mongoose.connection.on('open', () => {
    // Wait for mongodb connection before server starts
    app.listen(process.env.PUBLIC_PORT, () => {
      console.log('Server started.');
    });
  });
} catch (e) {
  console.log(e.message);
}
const shortURLSchema = new Schema({
  original_url: { type: String, required: true, unique: true },
  short_url: { type: Number, required: true, unique: true },
});
const UrlEntry = mongoose.model('UrlEntry', shortURLSchema);

// Methods for creating and finding shortened URL entries on the database
const newUrlId = () => {
  const result = UrlEntry.find({})
    .sort({ short_url: 'desc' })
    .limit(1)
    .then((urlEntries) => {
      console.log('No error creating id...');
      return urlEntries[0].short_url + 1;
    }, (err) => {
      if (err) return console.log('There was an error creating the id.');
    });
  return result;
};
const createUrlEntry = (url, shortUrl, done) => {
  let entry = new UrlEntry({
    original_url: url.href,
    short_url: shortUrl,
  });
  return entry.save((err, urlEntry) => {
    if (err) return done(err);
    done(null, urlEntry);
  });
};
const findUrlEntry = (url, shortUrl = null, done) => {
  if (shortUrl == null) {
    return UrlEntry.findOne({ original_url: url.href }, (err, urlEntry) => {
      if (err) return done(err);
      done(null, urlEntry);
    }).clone();
  } else {
    return UrlEntry.findOne({ short_url: shortUrl }, (err, urlEntry) => {
      if (err) return done(err);
      done(null, urlEntry);
    }).clone();
  }
};
const urlExists = async (url) => {
  let resultObj = {};
  await findUrlEntry(url, null, (err, urlEntry) => {
    if (err || !urlEntry) {
      console.log('URL not found in db');
      resultObj = {
        urlExistsBool: false,
        urlObj: {},
      };
    } else if (urlEntry) {
      console.log('URL found in db: ' + urlEntry);
      resultObj = {
        urlExistsBool: true,
        urlObj: urlEntry,
      };
    }
  });
  return resultObj;
};

// Standard 'invalid url' error
const urlError = { error: 'invalid url' };

// Register input URLs to unique ids and display their array entries.
app.post('/api/shorturl/', async (req, res) => {
  let fullURL;
  try {
    fullURL = new URL(req.body.url);
  } catch (e) {
    console.log('Error: ' + e.message);
    res.json(urlError);
    return;
  }
  if (fullURL.protocol == 'ftp:') {
    res.json(urlError);
    return;
  }
  const options = {
    family: 0,
  };
  console.log(fullURL ? 'URL Exists...' : 'No URL');
  // Get the result of a true / false check of whether the current URL already has an entry, and if so, return its object
  const result = await urlExists(fullURL);
  console.log(result);
  dns.lookup(fullURL.hostname, options, async (err) => {
    console.log('Input URL: "' + fullURL.href + '"');
    if (err) {
      console.log(urlError);
      res.json(urlError);
      return;
    } else {
      console.log('URL Valid...');
      // Get a new id that will be used if we create a new entry.
      const id = await newUrlId();
      // Return true if there are no previous entries, and then create one
      if (result.urlExistsBool == false) {
        try {
          console.log('Creating db entry...');
          console.log(
            id ? '%cId exists' : '%cId does not exist',
            id ? 'red' : 'green'
          );
          createUrlEntry(fullURL, id, (err, urlEntry) => {
            if (err) {
              console.log(err);
              console.log('Error creating entry...');
              res.json(urlError);
              return;
            } else {
              console.log('Created entry, displaying...');
              res.json({
                original_url: urlEntry.original_url,
                short_url: urlEntry.short_url,
              });
              return;
            }
          });
        } catch (e) {
          console.log(e.message);
        }
      } else if (result.urlExistsBool == true) {
        console.log();
        findUrlEntry(fullURL, null, (err, urlEntry) => {
          if (err) {
            console.log('Error displaying entry...');
            res.json(urlError);
          } else {
            console.log('Displaying entry...');
            console.log(result.urlObj);
            res.json({
              original_url: result.urlObj.original_url,
              short_url: result.urlObj.short_url,
            });
          }
        });
      } else {
        res.status(400).json(urlError);
      }
    }
  });
});

// Use unique shorturl ids to redirect to the full-length URLs that they correspond to
app.get('/api/shorturl/:shortURL?', (req, res) => {
  const shortURL = req.params.shortURL;
  try {
    findUrlEntry(null, shortURL, (err, urlEntry) => {
      if (err) return console.log(err);
      if (urlEntry) {
        console.log(
          `[FOUND] sending "${urlEntry.original_url}" as redirect path for short_url id: "${urlEntry.short_url}"`
        );
        res.status(301).redirect(urlEntry.original_url);
        return;
      } else {
        console.log(
          `[NOT FOUND] short_url id: "${shortURL}" has no matching entry, sending error JSON.`
        );
        res.status(400).json(urlError);
        return;
      }
    });
  } catch (e) {
    console.log(e.message);
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});