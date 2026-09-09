# WOD Discord Message Bot v2

This version accepts the exact message syntax:

```text
/gear https://warofdragons.com/user_info.php?nick=cryocore&noredir=...
```

The full profile URL is preserved, including `noredir`.

A fallback `!gear <url>` is also accepted in case a Discord client locally intercepts `/gear`.

## Discord requirement

Because this is a normal message command, enable **Message Content Intent** in:

Discord Developer Portal → Bot → Privileged Gateway Intents → Message Content Intent

## Environment

```text
DISCORD_TOKEN=your_bot_token
PORT=3000
```

## Run

```bash
npm install
npm run check
npm start
```

## Permissions needed when inviting the bot

- View Channels
- Send Messages
- Embed Links
- Read Message History

No slash command registration and no Interactions Endpoint URL are used.


## v2.5.0 visual layout
- Restores one compact card per equipment slot.
- Style image LEFT, actual image RIGHT, equal 180x180 display boxes.
- The pair is rendered as one wide 760px strip so Discord displays it at the card's full image width.
- Keeps Style/Actual clickable text and Rune/Bezel/Plate/Gem/Sharpening/Symbol text/icons.
- Removes stats and durability.


## v2.5.1 parser fix
- Fixes `Ringmail` armor being mistaken for a `Ring`.
- Rings use verified kind_id 76/221; amulets use kind_id 25.
- Text fallback is only used when kind_id is absent, and `ring` must be a whole word.


## v2.5.2 image resolver fix
- Official item-page image extraction is now item-title aware.
- Strongly prefers the image nearest the actual item's title.
- Penalizes rune/symbol/bezel/plate/enchantment assets so they are not used as the real equipment picture.


## v2.5.3 owner commands
Set `BOT_OWNER_ID` in Railway to your Discord user ID.

- `/guilds` — owner-only; lists every server GearMate is currently connected to, with server ID, member count, and owner ID.
- `/leaveguild <server ID>` — owner-only; makes GearMate leave that server immediately.
- `!guilds` and `!leaveguild` are accepted as fallbacks.
- Non-owner attempts are ignored.
