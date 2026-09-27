# 📰 Blog Aggregator

A local command-line program that stores users, RSS feeds, follows, and posts in PostgreSQL.

The npm package name is `blog_aggregator`, version `1.0.0`. This repository has no `gator` executable. You run the program with `npm start` from the project directory. The name gator appears in two places in the code: the config file is `.gatorconfig.json`, and each RSS request sends the header `User-Agent: gator`.

The program listens on no port. It does not start a website, and this repository does not deploy it anywhere.

`agg` saves posts from feeds stored in the database. `browse` prints posts from feeds the current user follows. Following a feed does not download posts. Downloading happens while `agg` is running.

<br>

<h2 id="contents">📋 Contents</h2>

- [📘 About](#about)
- [🧰 What you need](#what-you-need)
- [▶️ Config file and running](#config)
- [⌨️ Commands](#commands)
- [📡 Scraping](#scrape)
- [🗄️ Database](#database)
- [🧱 Stack](#stack)
- [🗺️ Layout](#layout)
- [🔍 Scope](#scope)
- [📞 Contact](#contact)

<br>

<br>

<h2 id="about">📘 About</h2>

Four tables hold the data: `users`, `feeds`, `feed_follows`, and `posts`. The Drizzle definitions are in `src/db/schema.ts`. SQL migrations generated from that schema are in `src/db/migrations/`. Starting the CLI does not apply those migrations.

The current user is a name stored in the config file on this machine. Commands that need a user read that name and load the matching database row. The program does not ask for a password.

| Link | What the database stores |
| --- | --- |
| Owner | `feeds.user_id` is required. Feed URLs are unique. Feed names are not unique. Migration `0002` sets `feeds.url` to not null. |
| Follow | Each follow row links one user to one feed. The pair `(feed_id, user_id)` is unique, so the same user cannot follow the same feed twice. |
| Post | Each post belongs to one feed (`posts.feed_id`). Post URLs are unique across the whole table. Posts are not stored per user. |
| Read path | `browse` uses the current user's follows. `agg` reads the whole `feeds` table and fetches one stored feed per tick. |

<br>

<h3 id="about-code">🧩 What the code is doing</h3>

- `src/index.ts` assigns each command on a `CommandsRegistry` object. It does not call `registerCommand`.
- `src/mw/index.ts` wraps `addfeed`, `follow`, `following`, `unfollow`, and `browse`.
- `src/rss/index.ts` parses an `rss` / `channel` document with `fast-xml-parser`. The handler never reads an RSS version attribute.
- `agg` fetches one feed per tick until the process receives `SIGINT` (Ctrl+C).

<br>

<br>

<h2 id="what-you-need">🧰 What you need</h2>

The gator CLI is this program. You run it with `npm start` from the project directory. There is no `gator` binary to install.

The program does not install PostgreSQL, does not create the database, and does not start a website. You provide the items below yourself.

| Need | What has to be true before a command works |
| --- | --- |
| Node.js and npm | `.nvmrc` lists `22.15.0`. Nothing in the program reads that file. `package.json` has no `engines` field. RSS calls global `fetch`, which Node.js has included since version 18. `npm start` runs `tsx ./src/index.ts`. |
| PostgreSQL | You create an empty database. Migrations call `gen_random_uuid()` and do not run `CREATE EXTENSION`. That function is built in on PostgreSQL 13 and later. On an older server it exists only when `pgcrypto` is already installed. |
| The same URL in two places | Drizzle Kit reads `DATABASE_URL`. The CLI reads `db_url` from the home-directory config file. Different databases in those two URLs means migrations and commands do not share data. |
| Config file first | Importing `src/db/index.ts` calls `readConfig()`. That import happens when the process loads, before `main` looks at your arguments. A missing file (`ENOENT` from `readFileSync`), invalid JSON (`SyntaxError` from `JSON.parse`), a non-object (`Invalid config format`), or a non-string `db_url` (`Missing or invalid dbUrl in config`) stops every command, including `register`. |
| Network for `agg` | `agg` must reach each feed URL. Every start reads the config file during import. `postgres(config.dbUrl)` runs only after that read returns, and that call builds the client. A start that fails in `readConfig()` never reaches a query. `register` and `login` call `setUser`, which writes the file when the name length is greater than 0. |

Imports run before the body of `src/index.ts`. `readConfig()` runs during that import. When it returns, `postgres(config.dbUrl)` builds the client and does not open a socket. `dns.setDefaultResultOrder("ipv4first")` runs after those imports and before `main()`. The first query opens the socket, and that query runs after the DNS line. RSS fetches in `agg` also happen after that DNS line.

<br>

<br>

<h2 id="config">▶️ Config file and running</h2>

Run these steps from the project directory. The examples use `npm start --` so npm forwards the arguments to the script.

<br>

<h3 id="config-install">📦 1. Install</h3>

```bash
npm install
```

<br>

<h3 id="config-migrate">🛠️ 2. Create the database and migrate</h3>

Create an empty PostgreSQL database. `drizzle.config.ts` loads `dotenv/config` and passes `process.env.DATABASE_URL` to Drizzle Kit. If `DATABASE_URL` is already set in the shell, that value is used. If it is not set, dotenv loads it from a `.env` file in the project root. The CLI does not load `.env`.

Put this in a `.env` file in the project root, or export the same variable in the shell before migrating:

```bash
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/DATABASE_NAME
```

```bash
npm run migrate
```

Replace `USER`, `PASSWORD`, and `DATABASE_NAME` with your own values. A bare assignment on its own line is not passed into `npm` unless it is exported or written in `.env`.

`npm run migrate` reads `src/db/migrations/meta/_journal.json`. Each entry's `when` value is the migration time. Drizzle creates the schema `drizzle` and the table `__drizzle_migrations` if they are missing. This config does not set `migrations.schema` or `migrations.table`, so those defaults are used. When that table has no rows, every journal entry is applied. When it has rows, an entry is applied when its `when` value is greater than the latest `created_at`. The pending SQL statements run inside one database transaction.

`npm run generate` runs `drizzle-kit generate` against `src/db/schema.ts`. It writes a new SQL file when the schema differs from the last snapshot in `src/db/migrations/meta/`. The SQL files for a first run are already in the repository. You do not need `generate` to boot.

<br>

<h3 id="config-file">📝 3. Write the config file</h3>

The path is `path.join(os.homedir(), ".gatorconfig.json")`. When Node runs in Ubuntu or WSL, that is:

`~/.gatorconfig.json`

When Node runs on Windows, the file is in the Windows user profile. A `.gatorconfig.json` inside this project is a different file. The program does not read it.

```json
{
  "db_url": "postgres://USER:PASSWORD@localhost:5432/DATABASE_NAME"
}
```

`db_url` must be a string. Use the same URL as `DATABASE_URL`.

`current_user_name` is optional when you write the file by hand. The program does not check that this field is a string. `register` and `login` are the only commands that write the file. `setUser` returns without writing when the username length is `0`. After a non-empty name is written, `writeConfig` replaces the file with only `db_url` and `current_user_name`, indented with two spaces. Any other key you added by hand is dropped on that write. Keep the file on your machine.

<br>

<h3 id="config-run">🚀 4. Run a few commands</h3>

```bash
npm start -- register YOUR_NAME
npm start -- addfeed "FEED_NAME" "https://HOST/path.xml"
npm start -- agg 1m
```

Stop `agg` with Ctrl+C. In another terminal, from the same project directory:

```bash
npm start -- browse
```

`https://HOST/path.xml` is a placeholder. Replace it with a real URL whose body is an `rss` document with a `channel`.

`npm start` with no command throws `There isn't at least one argument!`. The `process.exit(1)` on the next line of `src/index.ts` never runs, because the throw happens first. An unknown command throws `Command '<name>' not found`. After a command returns, `main` calls `process.exit(0)`. A thrown error is not caught in `main`.

The full argument rules, prints, and errors are in [⌨️ Commands](#commands).

<br>

<br>

<h2 id="commands">⌨️ Commands</h2>

```bash
npm start -- <command> [args]
```

Handlers do not trim arguments. Middleware runs before the handler, so a missing user is reported before an argument-count error.

| Command | Middleware first | One-line result |
| --- | --- | --- |
| [`login`](#cmd-login) | no | Calls `setUser` when that user row exists. `setUser` writes when the name length is greater than 0 |
| [`register`](#cmd-register) | no | Inserts a user, then writes the name when its length is greater than 0 |
| [`reset`](#cmd-reset) | no | Deletes every user row |
| [`users`](#cmd-users) | no | Prints every name |
| [`agg`](#cmd-agg) | no | Fetches one stored feed per tick until Ctrl+C |
| [`addfeed`](#cmd-addfeed) | yes | Inserts a feed owned by the current user, then follows it |
| [`feeds`](#cmd-feeds) | no | Prints every feed |
| [`follow`](#cmd-follow) | yes | Follows a feed already stored under that URL |
| [`following`](#cmd-following) | yes | Prints feed names the current user follows |
| [`unfollow`](#cmd-unfollow) | yes | Deletes that follow |
| [`browse`](#cmd-browse) | yes | Prints posts from followed feeds |

Logged-in commands are `addfeed`, `follow`, `following`, `unfollow`, and `browse`. The middleware throws `User does not exist!` when `current_user_name` is missing or otherwise falsy. A truthy name with no user row throws `User not found`.

`users`, `feeds`, `following`, and `browse` print nothing when the list is empty. Their handlers also contain an else that prints `Something happened, retry later!`. The current query functions return arrays, and an empty array is still returned, so that else does not run for an empty list.

Jump to a command: [🔐 login](#cmd-login) · [✨ register](#cmd-register) · [🧹 reset](#cmd-reset) · [👥 users](#cmd-users) · [⏱️ agg](#cmd-agg) · [➕ addfeed](#cmd-addfeed) · [📃 feeds](#cmd-feeds) · [👉 follow](#cmd-follow) · [📋 following](#cmd-following) · [👋 unfollow](#cmd-unfollow) · [👀 browse](#cmd-browse)

<br>

<h3 id="cmd-login">🔐 login</h3>

Looks up the first argument. A found row calls `setUser`, then prints the success line.

| | |
| --- | --- |
| Middleware | no |
| Arguments | At least one. Uses `args[0]` and ignores extras. |
| Prints | `User has been set!` |
| No arguments | `the login handler expects a single argument, the username` |
| Unknown name | `User does not exist!` |

An empty-string argument has `args.length === 1`, so the "single argument" error does not run. `getUserByName("")` runs first. When that row is missing, the command throws `User does not exist!` and does not write the file. When a user named `""` already exists, `setUser` returns without writing, and the command still prints `User has been set!`.

<br>

<h3 id="cmd-register">✨ register</h3>

Inserts one row, then always calls `setUser` with the same argument. `setUser` writes only when the length is greater than 0. The handler then loads the row again and prints it.

| | |
| --- | --- |
| Middleware | no |
| Arguments | At least one. Uses `args[0]` and ignores extras. |
| Prints | `User has been created!` and the user object (`id`, `createdAt`, `updatedAt`, `name`) |
| No arguments | `the register handler expects a single argument, the username` |
| Insert error | `User already exists!` |

`createUser` catches every insert error and throws `User already exists!`. A connection failure gets that same message. The throw happens before `setUser`, so a failed register leaves `current_user_name` unchanged.

User names are unique. The handler does not check length before the insert. A successful insert of a zero-length name still calls `setUser`, and `setUser` then returns without writing.

<br>

<h3 id="cmd-reset">🧹 reset</h3>

Deletes every row in `users`. There is no `WHERE` clause. The handler does not delete the other tables itself, and it does not change the config file.

| | |
| --- | --- |
| Middleware | no |
| Arguments | Ignored |
| At least one deleted user | `Users have been cleared!` |
| Zero deleted users | `Something happened, retry later!` |

`clearUsers` uses `.returning()` and keeps only the first returned row for that message. Every user row is still deleted. A database error throws, and that error is a different outcome from the "retry later" line.

The migration foreign keys use `ON DELETE cascade` and `ON UPDATE no action`. Deleting a user deletes that user's feeds and follow rows. Deleting a feed deletes its posts and its follow rows. After `reset`, `current_user_name` is still in the config file, and no user rows remain. `login` with that old name throws `User does not exist!`. `register` can insert the name again. `login` writes a name only when that row already exists. A logged-in command for a config name with no row throws `User not found`.

<br>

<h3 id="cmd-users">👥 users</h3>

Prints one name per line. The name that equals `current_user_name` is printed as `NAME (current)`, with a space before the parenthesis. Other names are printed alone. There is no `ORDER BY`.

| | |
| --- | --- |
| Middleware | no |
| Arguments | Ignored |
| Empty table | No lines |
| Config name with no matching row | No line gets ` (current)` |

<br>

<h3 id="cmd-agg">⏱️ agg</h3>

Prints `Collecting feeds every <duration>` using the argument text, starts one scrape immediately, then starts a scrape on every interval. The next tick does not wait for the previous scrape. There is no lock, so two overlapping ticks can select the same feed. The loop stops on `SIGINT`. There is no `SIGTERM` handler.

| | |
| --- | --- |
| Middleware | no |
| Arguments | Exactly one. Any other count throws `Expects 1 argument!` before duration parsing. |
| Duration | A whole number plus `ms`, `s`, `m`, or `h`. The check is `^(\d+)(ms|s|m|h)$`. Anything else throws `invalid duration`. |
| Ctrl+C | Prints `Shutting down feed aggregator...`, clears the timer, then `main` calls `process.exit(0)`. An in-flight scrape is not awaited. |

| Text | Milliseconds |
| --- | --- |
| `500ms` | 500 |
| `30s` | 30000 |
| `1m` | 60000 |
| `1h` | 3600000 |
| `0s` | 0, and `setInterval` receives 0 |

The multipliers in code are `ms = 1`, `s = 1000`, `m = 60000`, `h = 3600000`. `1.5s`, `1S`, and `1 m` fail the pattern.

Each tick selects one row from every feed in the table: `ORDER BY last_fetched_at ASC NULLS FIRST LIMIT 1`, with no second sort column. `NULL` comes first. The current user is not used.

Fetch details, including what a duplicate post URL does, are in [📡 Scraping](#scrape).

<br>

<h3 id="cmd-addfeed">➕ addfeed</h3>

Inserts a feed owned by the current user, then inserts a follow for that same user. The two writes are separate statements. There is no transaction around them. If the follow insert fails, the feed row remains.

The name you pass is stored as `feeds.name`. The RSS channel title is not read here and is not copied into that column. The URL is stored as given.

| | |
| --- | --- |
| Middleware | yes. Missing user throws before the argument check. |
| Arguments | Exactly two: name and url. Any other count throws `addfeed expects two arguments: name and url`. |
| Prints | The feed name and the user name, as two `console.log` arguments |
| Feed insert error | `Feed already exists!` |
| Feed function returns no row | `Feed insert failed` |
| Follow function returns no row | `Follow insert failed` |
| Empty feed name or user name at print time | `helperPrintFeed` throws `failed to print, feed or user equal null`. `handlerAddFeed` does not await that call, so the rejection does not reject `handlerAddFeed`. `main` can still reach `process.exit(0)`. |

`addFeed` catches every insert error and throws `Feed already exists!`. A connection failure gets that same message. Feed URLs are unique. Feed names are not. A second follow of the same feed by the same user fails in `createFeedFollow` with the driver's unique-violation error. That function does not replace the driver error. It throws `Insert failed` only when the insert returns no row.

<br>

<h3 id="cmd-feeds">📃 feeds</h3>

Prints every feed as three `console.log` arguments: feed name, feed URL, and the owner's name. There is no `ORDER BY`. Each feed loads its owner with a separate `getUserById` call. The handler reads `user.name` with no check.

| | |
| --- | --- |
| Middleware | no |
| Arguments | Ignored |
| Empty table | No lines |
| Owner row missing | TypeError: `Cannot read properties of undefined (reading 'name')` |

<br>

<h3 id="cmd-follow">👉 follow</h3>

Loads the feed by the first argument, then inserts a follow for the current user. Extra arguments are ignored.

| | |
| --- | --- |
| Middleware | yes |
| No arguments | `The handler expects a single argument!` |
| Prints | `Done!`, then `res?.feedName` and `res?.userName`. A missing info row still prints `Done!`. |
| URL not stored | TypeError: `Cannot read properties of undefined (reading 'id')`. There is no custom "feed not found" message. |
| Duplicate follow | The driver's unique-violation error |
| Insert returns no row | `Insert failed` |

A second `args.length === 0` check later in the handler is unreachable. Its message is `the handler expects a single argument!`, with a lowercase `the`. The check that runs uses `The handler expects a single argument!`.

<br>

<h3 id="cmd-following">📋 following</h3>

Prints the feed name for each follow of the current user, one name per line. The query has no `ORDER BY`.

| | |
| --- | --- |
| Middleware | yes |
| Arguments | Ignored |
| Empty list | No lines |

<br>

<h3 id="cmd-unfollow">👋 unfollow</h3>

Loads the feed by the first argument, deletes the follow for the current user and that feed, then prints the feed name from the feed row.

| | |
| --- | --- |
| Middleware | yes |
| No arguments | `The handler expects a single argument!` |
| Prints | `Unfollowed <feed name>` |
| URL not stored | TypeError: `Cannot read properties of undefined (reading 'id')` |
| No matching follow | `Follow not found`. The success line is not printed. |

Extra arguments are ignored. A second `args.length === 0` check later in the handler is unreachable. Its message is `the handler expects a single argument!`, with a lowercase `the`. The check that runs uses `The handler expects a single argument!`.

<br>

<h3 id="cmd-browse">👀 browse</h3>

Prints posts from feeds the current user follows. Each row is one `console.log` of an object with `id`, `title`, `url`, `description`, `publishedAt`, and `feedName`. Order is `published_at` descending, with no second sort column and no `NULLS` clause in the query.

| | |
| --- | --- |
| Middleware | yes |
| Arguments | Optional first argument. Extras are ignored. |
| Omitted limit | `2` |
| Given limit | `parseInt(args[0])` with no radix and no check for `NaN`, `0`, or a negative number. That value is passed to `.limit()`. |
| Empty result | No lines |

`parseInt("10abc")` is `10`. `parseInt("abc")` is `NaN`. The string `"0"` is used and becomes limit `0`. An empty string is falsy, so the limit stays `2`.

The query joins `posts` to `feeds` to `feed_follows` and keeps rows whose follow belongs to the current user. The unique pair `(feed_id, user_id)` means one follow does not duplicate a post for that user. A post on a feed this user does not follow is left out. Posts are still shared rows. Another follower of the same feed sees the same post row.

<br>

<br>

<h2 id="scrape">📡 Scraping</h2>

`scrapeFeeds` in `src/command.ts` loads the next feed, fetches it, marks it fetched, then inserts items. `fetchFeed` in `src/rss/index.ts` does the HTTP request and the XML read.

<br>

<h3 id="scrape-request">🌐 Request</h3>

`fetch` is called with one header, `User-Agent: gator`. The status code is not checked. The body is read with `response.text()`. The parser is created with `processEntities: false` and no other options.

These `fast-xml-parser` defaults stay on because the code does not set them:

| Default | Effect here |
| --- | --- |
| `ignoreAttributes: true` | Attributes are dropped. An RSS version attribute is not in the parsed object. The code also never reads one. |
| `trimValues: true` | Text inside tags is trimmed. |
| `parseTagValue: true` | Numeric-looking text can become a number before the checks below. |
| `processEntities` | Overridden to `false` by this program. |

<br>

<h3 id="scrape-feed">📥 What counts as a feed</h3>

The code reads `rss.channel` only. Atom is not handled.

| Parsed shape | Result |
| --- | --- |
| No `rss.channel` | `RSS feed missing rawChannel` |
| Channel title, link, or description missing or falsy | `Invalid RSS feed metadata` |
| One `item` object | Wrapped into a one-element array |
| No `item` | The item list is empty |

Channel title, link, and description are checked and then discarded. They are not written to `feeds`.

An item is kept only when `title`, `link`, `description`, and `pubDate` are all truthy. Other items are skipped. `0` and `""` fail that check. A kept item is stored as:

| RSS field | Column |
| --- | --- |
| `title` | `posts.title` |
| `link` | `posts.url` |
| `description` | `posts.description` |
| `pubDate` | `posts.published_at` via `new Date(pubDate)` |
| the feed row | `posts.feed_id` |

`pubDate` is not checked with `Number.isNaN(date.getTime())`. The `pubDate ? ... : null` expression in `scrapeFeeds` does not see items the filter already dropped, because those items have no `pubDate`. The same is true of `description ?? null`.

<br>

<h3 id="scrape-save">💾 Save order</h3>

1. `fetchFeed` returns.
2. `markFeedFetched` sets `last_fetched_at` and `updated_at` to `new Date()`.
3. Items are inserted one by one.

A throw from `fetch`, including a network error or `RSS feed missing rawChannel`, happens before step 2, so `last_fetched_at` stays as it was. A feed that returns and has zero qualifying items is still marked fetched.

`createPost` inserts with `onConflictDoNothing` on `posts.url`. When that insert returns no row, it throws `Something went wrong!`. There is no transaction. Items inserted earlier in that tick stay saved. Items later in the document are not inserted. The error is printed by the `.catch` on the scrape, and the interval continues until `SIGINT`.

The feed was already marked fetched, so the next tick can choose a different feed. When this same document is fetched again, the same stored URL throws again, and items after that URL in document order are still not saved.

When the `feeds` table is empty, the tick throws a TypeError reading `url` on `undefined`: `Cannot read properties of undefined (reading 'url')`. That error is printed and the interval continues. `fetchFeed` returns an object or throws, so the `Something happened, retry later!` branch inside `scrapeFeeds` does not run after a successful parse.

<br>

<br>

<h2 id="database">🗄️ Database</h2>

`src/db/index.ts` calls `postgres(config.dbUrl)` with no other options in code. That call builds the client. The socket opens on the first query. The client is not closed in code. `process.exit` ends the process.

Timestamps in the migrations are `timestamp` without time zone. Each `id` defaults to `gen_random_uuid()`. There is no `CREATE EXTENSION` in these files. There is no database trigger for `updated_at`. Each table's `updated_at` and `created_at` default to `now()` on insert. The only application update of `updated_at` is `markFeedFetched`, which sets `feeds.last_fetched_at` and `feeds.updated_at`. The schema's `$onUpdate` is Drizzle field metadata. The SQL files do not add an `ON UPDATE` trigger.

`npm run migrate` records applied work in `drizzle.__drizzle_migrations`.

| File | What it applies |
| --- | --- |
| `0000_steady_colonel_america.sql` | Creates `users` |
| `0001_magenta_cargill.sql` | Creates `feeds` with `url` still nullable and unique, and `feeds.user_id` referencing `users.id` `ON DELETE cascade` `ON UPDATE no action` |
| `0002_tan_king_cobra.sql` | Creates `feed_follows`, sets `feeds.url` `NOT NULL`, adds both follow foreign keys `ON DELETE cascade` `ON UPDATE no action`, and unique `(feed_id, user_id)` |
| `0003_natural_deadpool.sql` | Adds nullable `feeds.last_fetched_at` |
| `0004_quick_shockwave.sql` | Creates `posts` with unique `url` and `posts.feed_id` referencing `feeds.id` `ON DELETE cascade` `ON UPDATE no action` |

<br>

<h3 id="db-users">👤 users</h3>

| Column | Rule |
| --- | --- |
| `id` | `uuid` primary key, default `gen_random_uuid()`, not null |
| `created_at` | `timestamp`, default `now()`, not null |
| `updated_at` | `timestamp`, default `now()`, not null |
| `name` | `text`, not null, unique |

<br>

<h3 id="db-feeds">🗂️ feeds</h3>

| Column | Rule |
| --- | --- |
| `id` | `uuid` primary key, default `gen_random_uuid()`, not null |
| `created_at` | `timestamp`, default `now()`, not null |
| `updated_at` | `timestamp`, default `now()`, not null |
| `last_fetched_at` | `timestamp`, nullable. Added in `0003`. |
| `name` | `text`, not null. Not unique. |
| `url` | `text`, unique. Nullable in `0001`, then `NOT NULL` in `0002`. |
| `user_id` | `uuid`, not null, references `users.id` `ON DELETE cascade` `ON UPDATE no action` |

<br>

<h3 id="db-follows">🔗 feed_follows</h3>

| Column | Rule |
| --- | --- |
| `id` | `uuid` primary key, default `gen_random_uuid()`, not null |
| `created_at` | `timestamp`, default `now()`, not null |
| `updated_at` | `timestamp`, default `now()`, not null |
| `feed_id` | `uuid`, not null, references `feeds.id` `ON DELETE cascade` `ON UPDATE no action` |
| `user_id` | `uuid`, not null, references `users.id` `ON DELETE cascade` `ON UPDATE no action` |
| Unique | `(feed_id, user_id)` named `feed_follows_feed_user_unique` |

<br>

<h3 id="db-posts">📄 posts</h3>

| Column | Rule |
| --- | --- |
| `id` | `uuid` primary key, default `gen_random_uuid()`, not null |
| `created_at` | `timestamp`, default `now()`, not null |
| `updated_at` | `timestamp`, default `now()`, not null |
| `title` | `text`, not null |
| `url` | `text`, not null, unique |
| `description` | `text`, nullable. The scraper only inserts an item that had a description. |
| `published_at` | `timestamp`, nullable. The scraper passes `new Date(pubDate)` for kept items. |
| `feed_id` | `uuid`, not null, references `feeds.id` `ON DELETE cascade` `ON UPDATE no action` |

<br>

<br>

<h2 id="stack">🧱 Stack</h2>

| Piece | Where it is used |
| --- | --- |
| Node.js | Process runtime. `.nvmrc` lists `22.15.0`. The program does not read that file. |
| TypeScript | Source language. `package.json` has no `build` script. `tsconfig.json` sets `outDir` to `./dist`, and `npm start` does not compile into `dist`. |
| `tsx` `^4.23.15` | `npm start` runs `tsx ./src/index.ts` |
| PostgreSQL | Database you create |
| `postgres` `^3.4.9` | Driver used by the CLI |
| `drizzle-orm` `^0.45.3` | Schema and queries |
| `drizzle-kit` `^0.31.11` | `npm run generate` and `npm run migrate` |
| `dotenv` `^18.0.3` | Loaded by `drizzle.config.ts` only |
| `fast-xml-parser` `^5.11.1` | RSS parsing in `src/rss/index.ts` |
| `typescript` `^7.0.2` and `@types/node` `^26.6.2` | Dev dependencies declared in `package.json` |

Versions above are the ranges in `package.json`.

`package.json` sets `"type": "module"`, `"main": "index.js"`, and `"license": "ISC"`. There is no root `index.js`. There is no `LICENSE` file in this project. The `description` and `author` fields are empty.

The `repository` field is `git+https://github.com/mahmoudjawad02025/c_blog_aggregator.git`.

Repository page: [github.com/mahmoudjawad02025/c_blog_aggregator](https://github.com/mahmoudjawad02025/c_blog_aggregator)

| Script | What `package.json` runs |
| --- | --- |
| `npm start` | `tsx ./src/index.ts` |
| `npm run generate` | `drizzle-kit generate` |
| `npm run migrate` | `drizzle-kit migrate` |
| `npm test` | `echo "Error: no test specified" && exit 1` |

<br>

<br>

<h2 id="layout">🗺️ Layout</h2>

```text
src/index.ts            assigns commands and starts the process
src/command.ts          command handlers and scrapeFeeds
src/config.ts           reads and writes the home-directory config file
src/core/helpers.ts     parses agg durations
src/mw/index.ts         loads the current user for five commands
src/rss/index.ts        fetches one URL and reads an rss/channel document
src/db/schema.ts        users, feeds, feed_follows, posts
src/db/index.ts         creates a PostgreSQL client from db_url
src/db/queries/         database reads and writes
src/db/migrations/      SQL migrations and meta snapshots
drizzle.config.ts       Drizzle Kit config (DATABASE_URL)
.nvmrc                  lists 22.15.0; the program does not read it
```

`registerCommand` is exported from `src/command.ts` and is not called. `src/index.ts` writes the command map directly, then `runCommand` looks up `process.argv` after the first two entries.

<br>

<br>

<h2 id="scope">🔍 Scope</h2>

| Topic | What this program does |
| --- | --- |
| Login | Checks that the username exists, then calls `setUser`. There is no password. |
| Tests | `npm test` prints `Error: no test specified` and exits 1. There is no test suite. |
| HTTP server | The process binds no port. |
| RSS | `rss` / `channel` documents only. Atom is not handled. The version attribute is not read. |
| Posts | One row per URL in `posts`, shared by every follower of that feed. |
| Commands present | `login`, `register`, `reset`, `users`, `agg`, `addfeed`, `feeds`, `follow`, `following`, `unfollow`, `browse`. |
| Exit | A finished command calls `process.exit(0)`. `process.exit(1)` after the missing-argument throw is unreachable. |

<br>

<br>

<h2 id="contact">📞 Contact</h2>

📧 Email: mahmoudjawad02025@gmail.com

💻 GitHub Profile: [@mahmoudjawad02025](https://github.com/mahmoudjawad02025)

💼 LinkedIn: [linkedin.com/in/mahmoud-abu-alsebaa](https://www.linkedin.com/in/mahmoud-abu-alsebaa)

<br>
