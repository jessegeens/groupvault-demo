const axios = require('axios')
const MacaroonsBuilder = require('macaroons.js').MacaroonsBuilder;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const serverport = 8002;
const groupport = 8003;

const user = "jesse";
const group = "group1";

async function retrieveMacaroon() {

    // Fetch root macaroon from group server
    console.log("Fetching root macaroon from group server");
    let res = await axios.get(`http://localhost:${groupport}/idp/new_macaroon/${group}/${user}`)
    
    // Root macaroon needs discharge
    // -> Extract encrypted caveatKey and macaroon from response
    let caveatKey = res.data['caveatKey'];
    let myMacaroon = MacaroonsBuilder.deserialize(res.data['macaroon']);

    // Fetch discharge macaroon from authentication server (server.js)
    console.log("Fetching discharge macaroon");
    res = await axios.post(`http://localhost:${serverport}/idp/authorize`, {
        username: user,
        password: "myPassword",
        caveat: caveatKey,
        macaroon: myMacaroon.serialize()
    }, {
        "Content-Type" : "application/json"
    })

    let dischargeMacaroon = res.data['discharge'];

    return {
        macaroon: myMacaroon.serialize(),
        discharge: dischargeMacaroon
    };
}

async function requestResource() {
    let macaroonResult = await retrieveMacaroon();  
    let myBuilderMacaroon = macaroonResult['macaroon'];
    let discharge = macaroonResult['discharge'];
    
    try {
        let myMacaroon = MacaroonsBuilder.modify(
            MacaroonsBuilder.deserialize(myBuilderMacaroon))
            //.add_first_party_caveat("method = GET")
            //.add_first_party_caveat("identifier = " + uuid.v4())
            .getMacaroon();
        let result = await axios
            .get(`http://localhost:${groupport}/${group}/resource`, {
                headers: {
                    'macaroon': myMacaroon.serialize(),
                    'discharge': discharge
                }
            })
        console.log(result.data);
    } catch (ex) {
        console.log("Error fetching resource: " + ex);
    } 

    //await sleep(5000);

    try {
        let myMacaroon = MacaroonsBuilder.modify(
            MacaroonsBuilder.deserialize(myBuilderMacaroon))
            //.add_first_party_caveat("method = GET")
            //.add_first_party_caveat("identifier = " + uuid.v4())
            .getMacaroon();

        let result = await axios
            .get(`http://localhost:${groupport}/group1/resource`, {
                headers: {
                    'macaroon': myMacaroon.serialize(),
                    'discharge': discharge
                }
            })
        console.log("Second fetch: " + result.data);
    } catch (ex) {
        console.log("Failed fetching twice with same macaroon");
    }
        
}

requestResource();
