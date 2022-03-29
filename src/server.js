const mySecret = "VerySecretString";
const MacaroonsBuilder = require('macaroons.js').MacaroonsBuilder;
const MacaroonsVerifier = require('macaroons.js').MacaroonsVerifier;
var bodyParser = require('body-parser')
const port = 8002;
const NodeRSA = require('node-rsa');

const key = new NodeRSA().generateKeyPair();

const publicKey = key.exportKey('pkcs8-public-pem');
const privateKey = key.exportKey('pkcs1-pem');

const express = require('express');
const app = express();


// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.get('/public-key', function(_, res) {
  res.status(200).send(publicKey);
});

app.post('/idp/authorize', function(req, res) {
  let request = req.body;
  //console.log("Request body: " + JSON.stringify(req.body))
  let username = request['username'];
  let password = request['password'];
  let caveatKey = request['caveat'];
  let macaroonData = request['macaroon'];

  //console.log("CaveatKey Base64 is " + caveatKey);

  //let decryptedCaveatKey = caveatKey;
  let decryptedCaveatKey = key.decrypt(caveatKey); //PRIVATE_KEY.decrypt(Buffer.from(caveatKey, 'utf8'));
  console.log("Decrypted caveat key is " + decryptedCaveatKey);
  let macaroon = MacaroonsBuilder.deserialize(macaroonData);

  if(!(username == "jesse" && password == "myPassword")){
    res.status(403).send("Forbidden: invalid username or password");
  }

  let dischargeMacaroon = new MacaroonsBuilder(
    `http://localhost:${port}`,
    decryptedCaveatKey, 
    "caveat key id"
  )
  //.add_first_party_caveat("time < " + (Date.now() + 1000 * 5))
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

/*app.get('/idp/new_macaroon/:user', function(req, res) {
    let identifier = req.params.user;
    let location = "http://localhost:" + port;
    let myMacaroon = MacaroonsBuilder.create(location, "k_a", identifier);
    
    myMacaroon = MacaroonsBuilder.modify(myMacaroon)
    //.add_first_party_caveat("user = " + req.params.user)
    .add_first_party_caveat("time < " + (Date.now() + 1000 * 5))
    .getMacaroon();

    res.send(myMacaroon.serialize())
})*/

app.listen(port, function() {
  console.log(`[INFO] Third party auth server listening on port ${port}!`)
});
