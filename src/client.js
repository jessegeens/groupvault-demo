const axios = require('axios')
const MacaroonsBuilder = require('macaroons.js').MacaroonsBuilder;
const uuid = require("uuid");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 8002;

async function retrieveMacaroon() {
    let res = await axios.get(`http://localhost:${port}/idp/new_macaroon/jesse`)
    let myMacaroonData = res.data;
    let myMacaroon = MacaroonsBuilder.deserialize(myMacaroonData);
    return myMacaroon;
}

async function requestResource() {
    let myBuilderMacaroon = await retrieveMacaroon();  
    let myMacaroon = MacaroonsBuilder.modify(myBuilderMacaroon)
        .add_first_party_caveat("method = GET")
        .add_first_party_caveat("identifier = " + uuid.v4())
        .getMacaroon();
    let result = await axios
        .get(`http://localhost:${port}/jesse/resource`, {
            headers: {
                'macaroon': myMacaroon.serialize()
            }
        })
    console.log(result.data);

    //await sleep(5000);

    try {
        let myMacaroon = MacaroonsBuilder.modify(myBuilderMacaroon)
        .add_first_party_caveat("method = GET")
        .add_first_party_caveat("identifier = " + uuid.v4())
        .getMacaroon();

        let result = await axios
        .get(`http://localhost:${port}/jesse/resource`, {
            headers: {
                'macaroon': myMacaroon.serialize()
            }
        })
        console.log("Second fetch: " + result.data);
    } catch (ex) {
        console.log("Failed fetching twice with same macaroon");
    }
        
}

requestResource();
