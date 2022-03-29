# Groupvault Macaroons demo

This is a small NodeJS project to illustrate the use of [Macaroons](https://research.google/pubs/pub41892/) to realize decentralized authentication and authorization for group vaults in [Solid](https://solidproject.org/).

## Explanation

The code is written in JavaScript, running on the node engine. There are two server components and one client component. The [group server](src/groupserver.js) manages the files and keeps track of which users belong to which group. This server serves a macaroon (= access token, but only valid for a specific user and group), with a dependency that the user should be logged in at his authentication server. The [client](client.js) fetches the macaroon from the group server, and then fetches the *discharge macaroon* from the users [authentication server](src/server.js).

The caveat key is encrypted with the authentications public RSA key.

## Installation and running

1. Run `npm install` to install the necessary dependencies. 
2. Run `./start-server.sh` to run both servers (using tmux)
3. Run `node src/client.js` to run the client and make requests