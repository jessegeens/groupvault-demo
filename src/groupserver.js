//import { TimestampVerifier } from "./util.mjs";

const mySecret = "GroupServerSecretString";
const MacaroonsBuilder = require('macaroons.js').MacaroonsBuilder;
const MacaroonsVerifier = require('macaroons.js').MacaroonsVerifier;
const uuid = require("uuid");
const axios = require("axios");
const NodeRSA = require('node-rsa');
const bodyParser = require('body-parser')
const port = 8003;

const express = require('express');
const app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())


let generatedIdentifiers = [];
let parsedIdentifiers = [];
let groupToUsers = {
    'group1': ['jesse', 'roland']
}

function IdentifierVerifier(caveat) {
    if (!caveat.includes("identifier = ")) return false;
    let identifier = caveat.replace("identifier = ", "");
    if (parsedIdentifiers.includes(identifier)) {
        console.log("[WARN] Macaroon has already been used");
        return false;
    } else {
        console.log("[INFO] Verified unique identifier")
    }
    parsedIdentifiers.push(identifier);
    return true;
}

function TimestampVerifier(caveat) {
    if (!caveat.includes("time <")) return false;
    let timestamp = parseInt(caveat.replace("time < ", ""));
    if (timestamp > Date.now()){
        console.log("[INFO] Verified timestamp")
        return true;
    }
    console.log("[WARN] Macaroon has expired");
    return false;
  }

// Verify that the macaroon has access to the group
// to which the file belongs
function CorrectGroupVerifier(caveat, claimedGroup) {
    if (!caveat.includes("group = ")) return false;
    let group = caveat.replace("group = ", "");
    if(group == claimedGroup) return true;
    console.log(`[WARN] Macaroon valid for group ${group}, tries to acces ${claimedGroup}`);
    return false;
}

// Serve macaroons
// In a real-world application, credentials would be checked here
app.get('/idp/new_macaroon/:group/:user', async function(req, res) {
    let identifier = "caveat key id"; //uuid.v4();
    generatedIdentifiers.push(identifier);

    let caveatKey = "secret caveat key";//uuid.v4();

    // Third party caveat
    let foreignAuthLocation = "http://localhost:8002";

    let publicKey = (await axios.get(foreignAuthLocation + "/public-key")).data;

    let location = "http://localhost:" + port;
    let myMacaroon = MacaroonsBuilder.create(location, mySecret, "my_identifier");
    
    myMacaroon = MacaroonsBuilder.modify(myMacaroon)
    // Valid only for this group
    //.add_first_party_caveat("group = " + req.params.group)
    // Valid for five minutes
    .add_first_party_caveat("time < " + (Date.now() + 1000 * 60 * 5))
    // User at third party must be logged in
    .add_third_party_caveat(foreignAuthLocation, caveatKey, identifier)
    .getMacaroon();

    //let encryptedCaveatKey = caveatKey;
    let encryptedCaveatKey = new NodeRSA(publicKey).encrypt(caveatKey).toString('utf8');

    //console.log(`Encrypted caveat key: ${encryptedCaveatKey.toString('base64')}`);

    res.send(JSON.stringify({
        macaroon: myMacaroon.serialize(),
        caveatKey: encryptedCaveatKey
    }));
})

app.get('/:group/:file', function(req, res) {
    // Check if there is an auth token attached to the request
    let auth = req.headers['macaroon'];
    if(!auth) res.status(403).send("Forbidden");
    let myMacaroon = MacaroonsBuilder.deserialize(auth);

    console.log(`Received request for ${req.params.group}/${req.params.file} with macaroon ${myMacaroon.inspect()}`);


    let discharge = MacaroonsBuilder.deserialize(req.headers['discharge']);


    let verifier = new MacaroonsVerifier(myMacaroon);
    verifier.satisfyGeneral((caveat) => CorrectGroupVerifier(caveat, req.params.group));
    verifier.satisfyGeneral(TimestampVerifier);
    verifier.satisfyExact(`method = ${req.method}`);
    verifier.satisfyGeneral(IdentifierVerifier);

    verifier.satisfy3rdParty(discharge);

    //console.log(`[INFO] Rec`)

    /*let group = myMacaroon.identifier;
    verifier.satisfyExact(`file = ${req.params.file}`);
    //verifier.satisfyExact(`user = ${req.params.user}`);
    verifier.satisfyExact(`method = ${req.method}`);
    verifier.satisfyGeneral(TimestampVerifier)
    //verifier.satisfyGeneral(IdentifierVerifier);
    verifier.satisfyGeneral((caveat) => CorrectGroupVerifier(caveat, req.params.group));
    if(verifier.isValid(mySecret)) {
        console.log("Valid before third party check");
    }
    verifier.satisfy3rdParty(myMacaroon)
   // verifier.satisfyGeneral((caveat) => UserInGroupVerifier(caveat, req.params.user));
*/
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
