const MacaroonsBuilder = require('macaroons.js').MacaroonsBuilder;
const MacaroonsVerifier = require('macaroons.js').MacaroonsVerifier;
const uuid = require("uuid");
const axios = require("axios");
const NodeRSA = require('node-rsa');
const bodyParser = require('body-parser')
const express = require('express');

const app = express();

const mySecret = "GroupServerSecretString";
const port = 8003;

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())


// In production app, would include WebIDs, based on which the public key
// can be fetched from the oidcIssuer element in the profile document
// Based on this, the discharge macaroons would also be constructed
let groupMembers = {
    'group1': ["jesse", "john"] 
}

let generatedIdentifiers = [];
let parsedIdentifiers = [];

// Counter replay attacks by keeping used identifiers
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

// Verify macaroon hasn't expired
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

// Verify that the user the macaroon is issued to
// is part of the group
function UserInGroupVerifier(caveat, group) {
    if (!caveat.includes("user = ")) return false;
    let user = caveat.replace("user = ", "");
    if(groupMembers[group].includes(user)) return true;
    console.log(`[WARN] Macaroon valid for user ${user}, who is not part of ${group}`);
    return false;
}

// Create new macaroons
app.get('/idp/new_macaroon/:group/:user', async function(req, res) {
    let caveatidentifier = "discharge id = " + uuid.v4();
    let identifier = uuid.v4();
    generatedIdentifiers.push(identifier);

    let caveatKey = uuid.v4();

    // Before issuing a macaroon for this group, make sure
    // user actually belongs to this group
    if(!groupMembers[req.params.group].includes(req.params.user)) {
        console.log("[WARN] User not belonging to group tried requesting macaroon");
        res.status(403).send("Forbidden: not a mamber of the group");
        return;
    }

    // Third party caveat

    // In production app, determine this based on webid document
    let foreignAuthLocation = "http://localhost:8002";

    let publicKey = (await axios.get(foreignAuthLocation + "/public-key")).data;

    let location = "http://localhost:" + port;
    let myMacaroon = MacaroonsBuilder.create(location, mySecret, identifier);
    
    myMacaroon = MacaroonsBuilder.modify(myMacaroon)
    // Valid only for this group
    .add_first_party_caveat("group = " + req.params.group)
    // Valid for five minutes
    .add_first_party_caveat("time < " + (Date.now() + 1000 * 60 * 5))
    // User at third party must be logged in
    .add_third_party_caveat(foreignAuthLocation, caveatKey, caveatidentifier)
    .getMacaroon();

    let rsa = new NodeRSA();
    rsa.importKey(publicKey);
    let encryptedCaveatKey = rsa.encrypt(caveatKey, 'base64');

    res.send(JSON.stringify({
        macaroon: myMacaroon.serialize(),
        caveatKey: encryptedCaveatKey
    }));
})

app.get('/:group/:file', function(req, res) {
    // Check if there is an auth token attached to the request
    let auth = req.headers['macaroon'];
    let dischargeEncoded = req.headers['discharge'];
    if(!auth || !dischargeEncoded) res.status(403).send("Forbidden");

    // Deserialize received macaroons
    let myMacaroon = MacaroonsBuilder.deserialize(auth);
    let discharge = MacaroonsBuilder.deserialize(dischargeEncoded);
    console.log(`[INFO] Received request for ${req.params.group}/${req.params.file}`); 

    //console.log(`Macaroon is ${myMacaroon.inspect()}`);

    // Verify all caveats of root macaroon
    // -> Includes verifying discharge macaroon
    let verifier = new MacaroonsVerifier(myMacaroon);
    verifier.satisfyGeneral((caveat) => CorrectGroupVerifier(caveat, req.params.group));
    verifier.satisfyGeneral((caveat) => UserInGroupVerifier(caveat, req.params.group));
    verifier.satisfyGeneral(TimestampVerifier);
    verifier.satisfyGeneral(IdentifierVerifier);
    verifier.satisfyExact(`method = ${req.method}`);
    verifier.satisfyExact(`file = ${req.params.file}`);
    verifier.satisfy3rdParty(discharge);

    if(verifier.isValid(mySecret)){
        res.send("Success! Very private resource");
    } else {
        console.log("[WARN] Invalid token passed!");
        res.status(403).send("Forbidden");
    }

});

app.listen(port, function() {
  console.log(`[INFO] Group server listening on port ${port}!`);
});
