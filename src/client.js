const axios = require('axios')
const MacaroonsBuilder = require('macaroons.js').MacaroonsBuilder;
const uuid = require("uuid");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const serverport = 8002;
const groupport = 8003;

async function retrieveMacaroon() {
    console.log("Fetching root macaroon from group server");

    let res = await axios.get(`http://localhost:${groupport}/idp/new_macaroon/group/jesse`)
    // First macaroon, needs discharge as well
    let myMacaroonData = res.data;
    let myMacaroon = MacaroonsBuilder.deserialize(myMacaroonData);

    console.log("Fetched macaroon:" + myMacaroon.inspect());


    console.log("Fetching discharge macaroon");
    res = await axios.get(`http://localhost:${serverport}/idp/new_macaroon/jesse`)
    let dischargeMacaroonData = res.data;
    let dischargeMacaroon = MacaroonsBuilder.deserialize(dischargeMacaroonData);

    console.log("Fetched discharge macaroon: " + dischargeMacaroon.inspect());

    let macaroon = MacaroonsBuilder.modify(myMacaroon)
        .prepare_for_request(dischargeMacaroon)
        .getMacaroon();

    return macaroon;
}

async function requestResource() {
    let myBuilderMacaroon = await retrieveMacaroon();  
    let myMacaroon = MacaroonsBuilder.modify(myBuilderMacaroon)
        .add_first_party_caveat("method = GET")
        .add_first_party_caveat("identifier = " + uuid.v4())
        .getMacaroon();
    let result = await axios
        .get(`http://localhost:${groupport}/jesse/resource`, {
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
        .get(`http://localhost:${groupport}/jesse/resource`, {
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
