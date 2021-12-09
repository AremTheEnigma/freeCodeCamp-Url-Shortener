/*
// I tried to get this project to work with MongoDB and mongoose,
// but I couldn't get it to work, and I was getting so many errors I wasn't
// sure where to begin with it, in the interest of actually getting this done,
// I've opted for this solution.
*/

require("dotenv").config({ path: './sample.env' });
const express = require("express");
const cors = require("cors");
const app = express();
const dns = require("dns");
const { json } = require("body-parser");

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use("/public", express.static(`${process.cwd()}/public`));

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/views/index.html");
});

// Array for URL / id pairs, as well as methods for creating entries and verifying URLs
const urlArr = [];
const formatUrlToHost = (url) => {
  const prefixRegexp = new RegExp("https?://", "i");
  const suffixRegexp = new RegExp("/$");
  url = url.replace(prefixRegexp, "");
  url = url.replace(suffixRegexp, "");
  return url;
};

const makeEntry = (id, url) => {
  return {
    original_url: url,
    short_url: id,
  };
};
const testMatches = (url) =>
  urlArr.filter((entry) => {
    const tempURL = url.href;
    if (entry.original_url == tempURL) {
      return true;
    }
    return false;
  });

// Register input URLs to unique ids and display their array entries.
app.post("/api/shorturl/", (req, res) => {
  let fullURL;
  try {
    fullURL = new URL(req.body.url);
  } catch (e) {
    console.log("Error: " + e.message);
    res.json({ error: "invalid url" });
    return;
  }
  if (fullURL.protocol == "ftp:") {
    res.json({ error: "invalid url" });
    return;
  }
  const options = {
    family: 0,
  };
  console.log(fullURL ? "URL Exists" : "No URL");
  dns.lookup(fullURL.hostname, options, (err) => {
    if (err || !fullURL) {
      res.json({ error: "invalid url" });
    } else {
      if (testMatches(fullURL).length == 0) {
        console.log("No previous entries found, adding entry.");
        urlArr.push(makeEntry(urlArr.length, fullURL.href));
        res.json(makeEntry(urlArr.length - 1, fullURL.href));
      } else if (testMatches(fullURL).length > 0) {
        console.log("Previous entry found. Displaying...");
        const previousEntryIndex = testMatches(fullURL)[0].short_url;
        res.json(urlArr[previousEntryIndex]);
      } else {
        console.log("Invalid URL.");
        res.json({ error: "invalid url" });
      }
      console.log(
        'Input URL: "' + fullURL.href + '", URL array length: ' + urlArr.length
      );
    }
  });
});

// Use unique shorturl ids to redirect to the full-length URLs that they correspond to
app.get("/api/shorturl/:shortURL?", (req, res) => {
  const shortURL = parseInt(req.params.shortURL);
  const originalURLEntry = urlArr.filter((entry) => {
    return entry.short_url == shortURL ? true : false;
  });
  const redirPath = originalURLEntry.length
    ? originalURLEntry[0].original_url
    : null;
  if (redirPath) {
    console.log(
      `original_url was found, sending: "${redirPath}" as redirect path.`
    );
    res.status(301).redirect(redirPath);
  } else {
    console.log("original_url was not found, sending error JSON instead.");
    res.json({ error: "invalid url" });
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});