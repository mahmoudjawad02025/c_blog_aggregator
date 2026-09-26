# Blog Aggregator

A local command-line program that stores users, RSS feeds, follows, and posts in PostgreSQL.

The npm package name is `blog_aggregator`. There is no `gator` executable. You run it with `npm start` from this project. The name gator appears in two places in the code: the config file is `.gatorconfig.json`, and each RSS request sends the header `User-Agent: gator`.

The program does not start a website, and this repository does not deploy it anywhere.

## Contents

- [📘 About](#about)
- [🧰 What you need](#what-you-need)
- [▶️ Config file and running gator](#config-file-and-running-gator)
- [⌨️ Commands](#commands)
- [🧱 Stack](#stack)
- [🗺️ Layout](#layout)
- [🔍 Scope](#scope)
- [📞 Contact](#contact)

## 📘 About

Four tables hold the data: `users`, `feeds`, `feed_follows`, and `posts`. The table definitions are in `src/db/schema.ts` (Drizzle). SQL migrations generated from that schema are in `src/db/migrations/`. Starting the CLI does not apply those migrations.

`agg` saves posts from feeds stored in the database. `browse` shows posts from feeds the current user follows. Following a feed does not by itself download posts. Downloading happens when `agg` is running.

The current user is a name stored in the config file on this machine. Commands that need a user read that name and load the matching database row. The program does not ask for a password.

How the rows connect:

- A user owns each feed (`feeds.user_id` is required). Feed URLs are unique. Migration `0002` sets `feeds.url` to not null.
- A follow links one user to one feed. The pair `(feed_id, user_id)` is unique, so the same user cannot follow the same feed twice.
- A post belongs to a feed (`posts.feed_id`). Post URLs are unique. Posts are not stored per user.
- `browse` reaches posts through the current user's follows. `agg` reads the `feeds` table directly.

### What this shows

The code in this repository demonstrates:

- command handlers assigned on a `CommandsRegistry` in `src/index.ts`
- a middleware wrapper around `addfeed`, `follow`, `following`, `unfollow`, and `browse`
- a four-table Postgres schema and Drizzle migrations
- parsing of an `rss` / `channel` document with `fast-xml-parser` (the code does not read an RSS version attribute)
- a timer in `agg` that fetches one feed per tick until the process receives `SIGINT` (Ctrl+C)

## 🧰 What you need

To run this CLI you need all of the following. The program does not install or create them for you.

- **Node.js 18 or newer, and npm.** `package.json` does not set an `engines` field. The RSS client calls the global `fetch` function, which Node.js has included since version 18. `npm start` runs `tsx ./src/index.ts`.
- **PostgreSQL, and a database you create yourself.** The migration SQL calls `gen_random_uuid()` and does not run `CREATE EXTENSION`. That function is built in on PostgreSQL 13 and later. On an older server it exists only when the `pgcrypto` extension is already installed.
- **The same database URL in two places.** Drizzle Kit reads `DATABASE_URL` when you migrate. The CLI reads `db_url` from the config file in the home directory when it starts. On Linux, including WSL, that file is `~/.gatorconfig.json`. If those URLs point at different databases, migrations and commands use different databases.
- **A config file before the first command.** Importing the database module calls `readConfig()`. A missing file, invalid JSON, a value that is not an object (`Invalid config format`), or a `db_url` that is not a string (`Missing or invalid dbUrl in config`) stops the process during startup, including for `register`.
- **A network path to each feed URL** when you run `agg`. Other commands only talk to PostgreSQL and the local config file.

On startup, `src/index.ts` sets Node's DNS result order to `ipv4first`.

## ▶️ Config file and running gator

Run these steps from the project directory.

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database and migrate

Create an empty PostgreSQL database, then point Drizzle at it. `drizzle.config.ts` loads `dotenv/config`. If `DATABASE_URL` is already set in the shell, that value is used. If it is not set, dotenv loads it from a `.env` file in the project root. The CLI does not load `.env`.

```bash
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/DATABASE_NAME
```

Replace `USER`, `PASSWORD`, and `DATABASE_NAME` with your own values. Nothing in this repository creates the PostgreSQL database.

```bash
npm run migrate
```

`npm run generate` runs `drizzle-kit generate` against `src/db/schema.ts`. It writes a new SQL file when the schema differs from the last snapshot in `src/db/migrations/meta/`. You do not need it for a first run. `npm run migrate` applies migration files from `src/db/migrations/` that are not yet recorded in the database.

### 3. Write the config file

Create this file in your home directory, not in the project folder. The path is `os.homedir()` joined with `.gatorconfig.json`. On Linux, including WSL, that is:

`~/.gatorconfig.json`

```json
{
  "db_url": "postgres://USER:PASSWORD@localhost:5432/DATABASE_NAME"
}
```

`db_url` must be a string. Use the same URL you used for `DATABASE_URL`.

`current_user_name` is optional in the file you write by hand. Every command reads the file while the process is starting, because the database module calls `readConfig()` on import. `register` and `login` then write `current_user_name`. `setUser` returns without writing when the username length is 0.

The file stores `db_url`. After `register` or `login` writes a non-empty name, it also stores `current_user_name`. Keep the file on your machine.

### 4. Run a command

```bash
npm start -- register YOUR_NAME
```

`npm start` with no command throws `There isn't at least one argument!`. An unknown command throws `Command '<name>' not found`.

A short path that uses the pieces above:

```bash
npm start -- register YOUR_NAME
npm start -- addfeed "FEED_NAME" "https://HOST/path.xml"
npm start -- agg 1m
```

Stop `agg` with Ctrl+C. In another terminal, from the same project directory:

```bash
npm start -- browse
```

`https://HOST/path.xml` is a placeholder. Replace it with a real URL whose body is an `rss` document with a `channel`. This program does not check an RSS version attribute.

## ⌨️ Commands

Every command goes through the start script. Arguments after `--` are passed to the CLI.

```bash
npm start -- <command> [args]
```

| Command | Needs current user | What the code does |
| --- | --- | --- |
| `register <name>` | no | Inserts one user. The name must be unique. It then calls `setUser`. That write happens only when the name length is greater than 0. It prints `User has been created!` and the user row. |
| `login <name>` | no | Loads that name from the database. If no row exists, it throws `User does not exist!`. If the row exists, it calls `setUser` and prints `User has been set!`. The print still happens when the name length is 0, and `setUser` does not write in that case. |
| `users` | no | Prints each user name. The name in the config file is printed with ` (current)`. |
| `reset` | no | Deletes every row in `users`. Feeds owned by those users, and those users' follows, are removed by `ON DELETE CASCADE`. Posts are removed because each post's feed is removed, and that foreign key also cascades. The config file is left as it is, including `current_user_name`. |
| `agg <duration>` | no | Prints `Collecting feeds every <duration>`, starts one scrape immediately, then starts one scrape on each interval, until `SIGINT` (Ctrl+C). On that signal it prints `Shutting down feed aggregator...` and clears the timer. `main` in `src/index.ts` then calls `process.exit(0)`. It does not wait for a scrape that is already running. |
| `addfeed <name> <url>` | yes | Inserts a feed with that name and a unique URL, owned by the current user, then follows it for that user. |
| `feeds` | no | Prints every feed in the database: name, URL, and the name of the user who added it. It reads that user's `.name` with no check for a missing user row. |
| `follow <url>` | yes | Follows a feed that is already stored under that URL. |
| `following` | yes | Prints the names of feeds the current user follows. |
| `unfollow <url>` | yes | Deletes the current user's follow for that stored URL. After the delete it prints `Unfollowed <feed name>`. If that follow row is missing, it throws `Follow not found` and does not print that line. |
| `browse [limit]` | yes | Prints posts from feeds the current user follows, ordered by `published_at` descending. The printed fields are `id`, `title`, `url`, `description`, `publishedAt`, and `feedName`. |

Commands that need a current user are `addfeed`, `follow`, `following`, `unfollow`, and `browse`. If `current_user_name` is missing, they throw `User does not exist!`. If the name is in the config file and the user row is gone, they throw `User not found`.

`register` and `login` use the first argument as the username. They require at least one argument. Extra arguments after the name are ignored.

`addfeed` requires exactly two arguments. `agg` requires exactly one. `follow` and `unfollow` require at least one argument and use the first argument as the feed URL.

`agg` durations match `^(\d+)(ms|s|m|h)$`: a whole number and one of `ms`, `s`, `m`, or `h`. Examples: `500ms`, `30s`, `1m`, `1h`. Anything else throws `invalid duration`.

Each `agg` tick loads one feed: among all rows in `feeds`, the one with the oldest `last_fetched_at`, with `NULL` first. The query has no second sort column, so ties are not ordered. The choice is not limited to feeds the current user follows. The first scrape starts immediately, and `setInterval` starts another on each tick. The code does not wait for one scrape to finish before the next tick starts.

`browse` uses `2` when you omit the limit. The optional argument is passed to `parseInt`. Each post is printed with `console.log` as one object.

`reset` on an empty `users` table prints `Something happened, retry later!` because the delete returns no row. When at least one user is deleted, it prints `Users have been cleared!`.

## 🧱 Stack

| Piece | Where it is used |
| --- | --- |
| Node.js | Process runtime |
| TypeScript | Source language |
| `tsx` | `npm start` runs `tsx ./src/index.ts` |
| PostgreSQL | Database |
| `postgres` | Driver used by the CLI |
| Drizzle ORM | Schema and queries |
| drizzle-kit | `npm run generate` and `npm run migrate` |
| `dotenv` | Loaded by `drizzle.config.ts` only |
| `fast-xml-parser` | RSS parsing in `src/rss/index.ts` |

`package.json` lists the license as `ISC`. This repository does not contain a `LICENSE` file.

Repository: [github.com/mahmoudjawad02025/c_blog_aggregator](https://github.com/mahmoudjawad02025/c_blog_aggregator)

## 🗺️ Layout

```text
src/index.ts                 assigns commands and starts the process
src/command.ts               command handlers and scrapeFeeds
src/config.ts                reads and writes ~/.gatorconfig.json
src/core/helpers.ts          parses agg durations
src/mw/index.ts              loads the current user for five commands
src/rss/index.ts             fetches one URL and reads an rss/channel document
src/db/schema.ts             users, feeds, feed_follows, posts
src/db/index.ts              creates a PostgreSQL client from db_url in the config file
src/db/queries/              database reads and writes
src/db/migrations/           SQL migrations
drizzle.config.ts            Drizzle Kit config (DATABASE_URL)
```

`package.json` sets `"main": "index.js"`. There is no root `index.js`. The command you run is the `start` script above.

## 🔍 Scope

These points describe the current code.

- `login` checks that the username exists, then calls `setUser`. It does not check a password. With no arguments, `login` throws `the login handler expects a single argument, the username`. `register` throws `the register handler expects a single argument, the username`.
- `npm test` runs `echo "Error: no test specified" && exit 1`. This repository has no test suite.
- `fetchFeed` does not check the HTTP status. It reads the response body as text and parses XML with `processEntities: false`.
- The parser requires `rss.channel` with a title, link, and description. It throws `RSS feed missing rawChannel` or `Invalid RSS feed metadata` when those are missing. It does not read an RSS version attribute. Atom feeds are not handled.
- An item is kept only when it has a title, link, description, and `pubDate`. Other items are dropped. A present `pubDate` is passed to `new Date`. The code does not check that the date is valid.
- After a fetch returns, the feed's `last_fetched_at` is updated, and then posts are inserted. A post URL that is already stored makes the insert return no row, and `createPost` then throws `Something went wrong!`. Items already inserted earlier in that tick stay saved. There is no rollback. Later items in that tick are not saved. The error is printed, and the interval keeps running until `SIGINT`.
- If the fetch throws, `last_fetched_at` is not updated for that attempt.
- If the `feeds` table is empty, that tick throws when it reads the next feed URL. The error is printed, and the interval keeps running.
- `follow` and `unfollow` load the feed by URL and then read `feed.id`. A URL that is not stored fails at that read.
- `agg` with a number of arguments other than 1 throws `Expects 1 argument!` before it parses the duration. `addfeed` with a number of arguments other than 2 throws `addfeed expects two arguments: name and url`.
- `addfeed` inserts the feed and the follow as two separate statements. The code does not wrap them in a transaction.
- A second follow of the same feed by the same user fails on the database unique key. `createFeedFollow` does not replace that database error with its own message.
- `createUser` and `addFeed` catch every insert error and throw `User already exists!` or `Feed already exists!`. A connection failure gets the same message as a duplicate row.
- The same user cannot follow the same feed twice. The database unique key is `(feed_id, user_id)`.
- The program listens on no port. It is not a hosted service.

## 📞 Contact

📧 Email: mahmoudjawad02025@gmail.com  
💻 GitHub Profile: [@mahmoudjawad02025](https://github.com/mahmoudjawad02025)  
💼 LinkedIn: [linkedin.com/in/mahmoud-abu-alsebaa](https://www.linkedin.com/in/mahmoud-abu-alsebaa)
