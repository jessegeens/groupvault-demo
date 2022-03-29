//import { TimestampVerifier } from "./util.mjs";

const mySecret = "GroupServerSecretString";
const MacaroonsBuilder = require('macaroons.js').MacaroonsBuilder;
const MacaroonsVerifier = require('macaroons.js').MacaroonsVerifier;
const port = 8003;

const express = require('express');
const app = express();

let parsedIdentifiers = [];

function IdentifierVerifier(caveat, parsedIdentifiers) {
    if (!caveat.includes("identifier = ")) return false;
    let identifier = caveat.replace("identifier = ", "");
    if (parsedIdentifiers.includes(identifier)) return false;
    parsedIdentifiers.push(identifier);
    return true;
}

function TimestampVerifier(caveat) {
    if (!caveat.includes("time <")) return false;
    let timestamp = parseInt(caveat.replace("time < ", ""));
    if (timestamp > Date.now()) return true;
    return false;
  }

// TODO implement
function UserInGroupVerifier(caveat, parsedIdentifiers) {
    return true;
}

app.get('/idp/new_macaroon/:group/:user', function(req, res) {
    let identifier = req.params.group;
    let location = "http://localhost:" + port;
    let myMacaroon = MacaroonsBuilder.create(location, mySecret, identifier);
    
    myMacaroon = MacaroonsBuilder.modify(myMacaroon)
    // Valid only for this group
    .add_first_party_caveat("group = " + req.params.group)
    // Valid for five minutes
    .add_first_party_caveat("time < " + (Date.now() + 1000 * 60 * 5))
    // User at third party must be logged in
    .add_third_party_caveat("http://localhost:8002", "thirdpartysecret", req.params.user)
    .getMacaroon();

    res.send(myMacaroon.serialize())
})

app.get('/:user/:file', function(req, res) {
    let auth = req.headers['macaroon'];
    if(!auth) res.status(403).send("Forbidden");
    let myMacaroon = MacaroonsBuilder.deserialize(auth);
    console.log(myMacaroon.inspect())
    let verifier = new MacaroonsVerifier(myMacaroon);
    let group = myMacaroon.identifier;
    verifier.satisfyExact(`file = ${req.params.file}`);
    //verifier.satisfyExact(`user = ${req.params.user}`);
    verifier.satisfyExact(`method = ${req.method}`);
    verifier.satisfyGeneral(TimestampVerifier)
    verifier.satisfyGeneral(IdentifierVerifier);
    verifier.satisfyGeneral(UserInGroupVerifier);

    // Verify third party Macaroon
    let d = new MacaroonsBuilder("http://localhost:8002", "thirdpartysecret", identifier)
    .add_first_party_caveat("time < " + (Date.now() + 1000 * 60 * 5))
    .getMacaroon();

    if(verifier.isValid(mySecret)){
        res.send("Success! Very private resource");
    } else {
        console.log("[WARN] Invalid token passed!")
        res.status(403).send("Forbidden")
    }
});

app.listen(port, function() {
  console.log(`[INFO] Group server listening on port ${port}!`)
});
