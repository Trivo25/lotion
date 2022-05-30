let lotion = require("./dist");

let app = lotion({
  initialState: {
    count: 0,
  },
  logTendermint: true,
  p2pPort: 25551,
  rpcPort: 25552,
  abciPort: 25553,
});

app.use(function (state, tx) {
  state.count++;
  console.log(state);
});

app.useBlock((state, context) => {
  state.blockCount++;
  let key = Object.keys(context.validators)[0];
  context.validators[key].power++;
  console.log(context);
});

app.start();

/* 
let createServer = require("./dist/server");
let server = createServer({
  info(request) {
    console.log("got info request", request);
    return {};
  },

  // implement any ABCI method handlers here
});
server.listen(26658);
 */
