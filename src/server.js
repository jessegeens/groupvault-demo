const mySecret = "VerySecretString";
const MacaroonsBuilder = require('macaroons.js').MacaroonsBuilder;
const MacaroonsVerifier = require('macaroons.js').MacaroonsVerifier;
const port = 8002;

const express = require('express');
const app = express();

let parsedIdentifiers = [];


function TimestampVerifier(caveat) {
  if (!caveat.includes("time <")) return false;
  let timestamp = parseInt(caveat.replace("time < ", ""));
  if (timestamp > Date.now()) return true;
  return false;
}

function IdentifierVerifier(caveat) {
  if (!caveat.includes("identifier = ")) return false;
  let identifier = caveat.replace("identifier = ", "");
  if (parsedIdentifiers.includes(identifier)) return false;
  parsedIdentifiers.push(identifier);
  return true;
}

app.get('/', function(req, res) {
  res.send('Hello World!')
});

app.get('/idp/new_macaroon/:user', function(req, res) {
    let identifier = req.params.user;
    let location = "http://localhost:" + port;
    let myMacaroon = MacaroonsBuilder.create(location, mySecret, identifier);
    
    myMacaroon = MacaroonsBuilder.modify(myMacaroon)
    //.add_first_party_caveat("user = " + req.params.user)
    .add_first_party_caveat("time < " + (Date.now() + 1000 * 5))
    .getMacaroon();

    res.send(myMacaroon.serialize())
})

/*app.get('/:user/:file', function(req, res) {
    let auth = req.headers['macaroon'];
    if(!auth) res.status(403).send("Forbidden");
    let myMacaroon = MacaroonsBuilder.deserialize(auth);
    console.log(myMacaroon.inspect())
    let verifier = new MacaroonsVerifier(myMacaroon);
    verifier.satisfyExact(`file = ${req.params.file}`);
    verifier.satisfyExact(`user = ${req.params.user}`);
    verifier.satisfyExact(`method = ${req.method}`);
    verifier.satisfyGeneral(TimestampVerifier)
    verifier.satisfyGeneral(IdentifierVerifier);
    if(verifier.isValid(mySecret)){
        res.send("Success! Very private resource");
    } else {
        console.log("[WARN] Invalid token passed!")
        res.status(403).send("Forbidden")
    }
});*/

app.listen(port, function() {
  console.log(`[INFO] Group server listening on port ${port}!`)
});
