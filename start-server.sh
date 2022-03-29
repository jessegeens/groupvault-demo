tmux \
    new-session  './node_modules/nodemon/bin/nodemon.js src/groupserver.js' \; \
    split-window -h './node_modules/nodemon/bin/nodemon.js src/server.js' \; 
