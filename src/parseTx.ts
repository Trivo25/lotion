let vstruct = require("varstruct");
let { stringify } = require("deterministic-json");

export function parseTx(txJson) {
  let nonce = Math.floor(Math.random() * (2 << 12));
  let txBytes = "0x" + encode(txJson, nonce).toString("hex");
  return txBytes;
}

let TxStruct = vstruct([
  { name: "data", type: vstruct.VarString(vstruct.UInt32BE) },
  { name: "nonce", type: vstruct.UInt32BE },
]);

export function encode(txData, nonce) {
  let data = stringify(txData);
  let bytes = TxStruct.encode({ nonce, data });
  return bytes;
}
