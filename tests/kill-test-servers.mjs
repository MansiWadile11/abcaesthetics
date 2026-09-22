/*
Close anything left listening on the test harness's ports.

  npm run test:clean            5176 (its dev server) and 8795 (its backend)
  npm run test:clean 5173       any other port

An interrupted test run can leave its Vite server behind. That server keeps
serving the site, but the Apps Script stand-in it was pointed at died with the
test - so the pages look completely normal and every submission fails with a
connection error. Confusing enough to be worth a command.

NOTE for anyone editing this: do NOT filter netstat with `-p tcp`. Vite binds
IPv6 by default, and `-p tcp` lists IPv4 only, so the listener you are looking
for is invisible and this script cheerfully reports "nothing listening".
*/

import { execSync } from "node:child_process"

const DEFAULT_PORTS = ["5176", "8795"]
const ports = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PORTS

const isWindows = process.platform === "win32"

function listeningPids(port) {
    if (!isWindows) {
        try {
            return execSync(`lsof -ti tcp:${port} -s TCP:LISTEN`, { encoding: "utf8" })
                .trim().split(/\s+/).filter(Boolean)
        } catch {
            return []
        }
    }

    let out = ""
    try {
        out = execSync("netstat -ano", { encoding: "utf8" })
    } catch {
        return []
    }

    const pids = new Set()
    for (const line of out.split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/)
        // proto  local-address  foreign-address  state  pid
        if (parts.length < 5 || parts[3] !== "LISTENING") continue

        // Match the port exactly - ":5176" must not also match ":51760".
        // Covers 0.0.0.0:5176, 127.0.0.1:5176 and [::1]:5176 alike.
        if (!new RegExp(":" + port + "$").test(parts[1])) continue

        const pid = parts[4]
        if (pid && pid !== "0") pids.add(pid)
    }
    return [...pids]
}

let stopped = 0

for (const port of ports) {
    const pids = listeningPids(port)

    if (!pids.length) {
        console.log(`port ${port}: nothing listening`)
        continue
    }

    for (const pid of pids) {
        try {
            // /T because the server is usually a child of a cmd.exe wrapper.
            execSync(isWindows ? `taskkill /pid ${pid} /T /F` : `kill ${pid}`, { stdio: "ignore" })
            console.log(`port ${port}: stopped pid ${pid}`)
            stopped++
        } catch (err) {
            console.log(`port ${port}: could not stop pid ${pid} - ${err.message.split("\n")[0]}`)
        }
    }
}

console.log(stopped ? `\nStopped ${stopped} process(es).` : "\nNothing to clean up.")
