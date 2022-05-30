import fs = require("fs-extra");
import { join } from "path";

interface PortMap {
  abci: number;
  rpc: number;
  p2p: number;
}

interface TendermintConfig {
  ports: PortMap;
  home: string;
  logTendermint?: boolean;
  genesisPath?: string;
  keyPath?: string;
  peers?: Array<string>;
}

export default async function createTendermintProcess({
  ports,
  home,
  logTendermint,
  genesisPath,
  keyPath,
  peers,
}: TendermintConfig): Promise<any> {
  /**
   * configure server listen addresses for:
   * - rpc (public)
   * - p2p (public)
   * - abci (local)
   */
  let opts: any = {
    rpc: { laddr: "tcp://0.0.0.0:" + ports.rpc },
    p2p: { laddr: "tcp://0.0.0.0:" + ports.p2p },
    proxy_app: "tcp://127.0.0.1:" + ports.abci,
  };

  /**
   * initialize tendermint's home directory
   * inside <lotion_home>/networks/<id>
   */
  await init(home);

  /**
   * disable authenticated encryption for p2p if
   * no peer strings containing ids are provided.
   */
  if (peers && peers.length > 0) {
    let shouldUseAuth = false;
    peers.forEach((peer) => {
      if (peer.indexOf("@") !== -1) {
        shouldUseAuth = true;
      }
    });

    if (!shouldUseAuth) {
      let cfgPath = join(home, "config", "config.toml");
      let configToml = fs.readFileSync(cfgPath, "utf8");
      configToml = configToml.replace("auth_enc = true", "auth_enc = false");
      fs.writeFileSync(cfgPath, configToml);

      /**
       * tendermint currently requires a node id even if auth_enc is off.
       * prepend a bogus node id for all peers without an id.
       */
      const bogusId = "0000000000000000000000000000000000000000";
      peers.forEach((peer, index) => {
        if (peer.indexOf("@") === -1) {
          peers[index] = [bogusId, peer].join("@");
        }
      });
    }

    opts.p2p.persistentPeers = peers.join(",");
  }

  /**
   * overwrite the generated genesis.json with
   * the correct one if specified by the developer.
   */
  if (genesisPath) {
    if (!fs.existsSync(genesisPath)) {
      throw new Error(`no genesis file found at ${genesisPath}`);
    }
    fs.copySync(genesisPath, join(home, "config", "genesis.json"));
  }

  /**
   * overwrite the priv_validator_key.json file with the one specified.
   *
   * the file is only copied if the pub_key in the specified file
   * doesn't match the one in the tendermint home directory.
   *
   */

  if (keyPath) {
    let privValPath = join(home, "config", "priv_validator_key.json");
    if (!fs.existsSync(keyPath)) {
      throw new Error(`no keys file found at ${keyPath}`);
    }
    let newValidatorJson = fs.readJsonSync(keyPath);
    let oldValidatorJson = fs.readJsonSync(privValPath);

    if (newValidatorJson.pub_key.value !== oldValidatorJson.pub_key.value) {
      fs.copySync(keyPath, privValPath);
    }
  }

  let closing = false;

  let tendermintProcess = node(home, opts);

  if (logTendermint) {
    tendermintProcess.stdout.pipe(process.stdout);
    tendermintProcess.stderr.pipe(process.stderr);
  }

  tendermintProcess.then(() => {
    if (closing) return;
    throw new Error("Tendermint exited unexpectedly");
  });

  //await tendermintProcess.synced();
  sleep(1000);

  return {
    close() {
      closing = true;
      tendermintProcess.kill();
    },
  };
}

// ----
let url = require("url");
let _exec = require("execa");
let _spawn = require("cross-spawn");
let { RpcClient } = require("tendermint");
let flags = require("./flags");

function init(home) {
  return exec("init", { home }, false);
}
function initSync(home) {
  return exec("init", { home }, true);
}
let binPath = join(__dirname, "../bin/tendermint");

if (process.platform === "win32") {
  binPath += ".exe";
}

const logging = process.env.TM_LOG;
binPath = process.env.TM_BINARY || binPath;

function exec(command, opts, sync) {
  let args = [command, ...flags(opts)];
  console.log("executing: tendermint " + args.join(" "));
  let res = (sync ? _exec.sync : _exec)(binPath, args);
  maybeError(res);
  return res;
}

function spawn(command, opts) {
  let args = [command, ...flags(opts)];
  console.log("spawning: tendermint " + args.join(" "));
  let child = _spawn(binPath, args);
  setTimeout(() => {
    try {
      child.stdout.resume();
      child.stderr.resume();
    } catch (err) {}
  }, 1000);
  if (logging) {
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
  }
  let promise = new Promise((resolve, reject) => {
    child.once("exit", resolve);
    child.once("error", reject);
  });
  child.then = promise.then.bind(promise);
  child.catch = promise.catch.bind(promise);
  return child;
}

function maybeError(res) {
  if (res.killed) return;
  if (res.then != null) {
    return res.then(maybeError);
  }
  if (res.code !== 0) {
    throw Error(`tendermint exited with code ${res.code}`);
  }
}

function node(path, opts: any) {
  if (typeof path !== "string") {
    throw Error('"path" argument is required');
  }

  opts.home = path;
  let child = spawn("start", opts);
  let rpcPort = getRpcPort(opts);

  return setupChildProcess(child, rpcPort);
}

function lite(target, chainId, path, opts: any) {
  if (typeof target !== "string") {
    throw Error('"target" argument is required');
  }
  if (typeof chainId !== "string") {
    throw Error('"chainId" argument is required');
  }
  if (typeof path !== "string") {
    throw Error('"path" argument is required');
  }

  opts.node = target;
  opts["chain-id"] = chainId;
  opts["home-dir"] = path;
  let child = spawn("lite", opts);
  let rpcPort = getRpcPort(opts, 8888);
  return setupChildProcess(child, rpcPort);
}

function setupChildProcess(child, rpcPort) {
  let rpc = RpcClient(`http://localhost:${rpcPort}`);
  let started, synced;
  return Object.assign(child, {
    rpc,
    started: (timeout) => {
      if (started) return started;
      started = waitForRpc(rpc, child, timeout);
      return started;
    },
    synced: (timeout = Infinity) => {
      if (synced) return synced;
      synced = waitForSync(rpc, child, timeout);
      return synced;
    },
  });
}

function getRpcPort(opts, defaultPort = 26657) {
  if (!opts || ((!opts.rpc || !opts.rpc.laddr) && !opts.laddr)) {
    return defaultPort;
  }
  let parsed = url.parse(opts.laddr || opts.rpc.laddr);
  return parsed.port;
}

let waitForRpc = wait(async (client) => {
  await client.status();
  return true;
});

let waitForSync = wait(async (client) => {
  let status = await client.status();
  return (
    status.sync_info.catching_up === false &&
    Number(status.sync_info.latest_block_height) > 0
  );
});

function wait(condition) {
  return async function (client, child, timeout = 30 * 1000) {
    let start = Date.now();
    while (true) {
      let elapsed = Date.now() - start;
      if (elapsed > timeout) {
        throw Error("Timed out while waiting");
      }

      try {
        if (await condition(client)) break;
      } catch (err) {}

      await sleep(1000);
    }
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
