const MacaroonsBuilder = require('macaroons.js').MacaroonsBuilder;
var bodyParser = require('body-parser')
const express = require('express');
const NodeRSA = require('node-rsa');

const app = express();

const key = new NodeRSA({b: 512});
const publicKey = key.exportKey('pkcs8-public-pem');
const port = 8002;

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

// Extreact caveat id from incoming root macaroon
// Necessary to create linked discharge macaroon
function extractCaveatId(macaroon) {
  let lines = macaroon.split('\n');
  for (const line of lines) {
    if (!line.includes("cid discharge id = ")) continue;
    let id = line.replace("cid ", "");
    return id;
  }
  return undefined;
}

// Endpoint for fetching server public key
app.get('/public-key', function(_, res) {
  res.status(200).send(publicKey);
});

// Endpoint for creating discharge macaroons
// validates user credentials
app.post('/idp/authorize', function(req, res) {
  let username = req.body['username'];
  let password = req.body['password'];
  let caveatKey = req.body['caveat'];
  let macaroonData = req.body['macaroon'];

  let decryptedCaveatKey = key.decrypt(caveatKey, 'utf8'); 
  let macaroon = MacaroonsBuilder.deserialize(macaroonData);

  if(!(username == "jesse" && password == "myPassword")){
    res.status(403).send("Forbidden: invalid username or password");
  }

  // Verify username in caveatKey is equal to username used to log in
  let claimedUsername = decryptedCaveatKey.replace("user = ", "")
  if(claimedUsername != username) {
    res.status(403).send("Forbidden: given username does not correspond to caveat")
    return;
  }

  //console.log(`Got macaroon: ${macaroon.inspect()}`);

  let caveatId = extractCaveatId(macaroon.inspect());

  let dischargeMacaroon = new MacaroonsBuilder(
    `http://localhost:${port}`,
    decryptedCaveatKey, caveatId)
    .add_first_party_caveat("time < " + (Date.now() + 1000 * 5))
    .add_first_party_caveat(decryptedCaveatKey)
    .getMacaroon();

  let preparedDischargeMacaroon = new MacaroonsBuilder.modify(macaroon)
    .prepare_for_request(dischargeMacaroon)
    .getMacaroon();

  console.log("[INFO] Sending discharge macaroon");
  res.status(200).send({
    macaroon: macaroon.serialize(),
    discharge: preparedDischargeMacaroon.serialize()
  });
});

app.listen(port, function() {
  console.log(`[INFO] Third party auth server listening on port ${port}!`)
});
