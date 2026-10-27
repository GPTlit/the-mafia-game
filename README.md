# Secret Society Social

Card in photo uploaded 1 is wolf

Card in photo uploaded 2 is detective

Card in photo uploaded 3 is doctor

Card in photo uploaded 4 is civilian

Here is the complete architectural and functional blueprint designed to feed directly into Lovable. It covers database schemas, state machines, role distributions, timer loops, and step-by-step game phases.

1. Database Schema & State Management (Supabase / PostgreSQL)

Tables

users

id (UUID, Primary Key)

username (Text, Unique)

phone_number (Text, Unique)

password_hash (Text)

avatar_url (Text)

created_at (Timestamp)

rooms

id (UUID, Primary Key)

room_code (Text, Unique)

host_id (UUID, Foreign Key to users)

status (Enum: LOBBY, IN_PROGRESS, FINISHED)

current_phase (Enum: ROLE_DISTRIBUTION, NIGHT_WOLVES, NIGHT_DETECTIVE, NIGHT_DOCTOR, NIGHT_RESULT, DAY_DISCUSSION, DAY_VOTING)

round_number (Integer)

room_players

id (UUID, Primary Key)

room_id (UUID, Foreign Key)

user_id (UUID, Foreign Key)

role (Enum: WOLF, DOCTOR, DETECTIVE, CIVILIAN)

is_ready (Boolean, Default false)

is_alive (Boolean, Default true)

self_heal_used (Boolean, Default false)

night_actions

id (UUID, Primary Key)

room_id (UUID, Foreign Key)

round_number (Integer)

wolf_target_user_id (UUID, Foreign Key, Nullable)

detective_target_user_id (UUID, Foreign Key, Nullable)

doctor_target_user_id (UUID, Foreign Key, Nullable)

messages

id (UUID, Primary Key)

room_id (UUID, Foreign Key)

sender_id (UUID, Foreign Key, Nullable - Null means System Operator)

channel (Enum: GLOBAL, WOLF_PRIVATE, DETECTIVE_PRIVATE)

content (Text, Nullable)

audio_url (Text, Nullable)

created_at (Timestamp)

votes

id (UUID, Primary Key)

room_id (UUID, Foreign Key)

round_number (Integer)

voter_id (UUID, Foreign Key)

target_id (UUID, Foreign Key)

2. Role Scaling Matrix (6 to 15 Players)

Implement this exact configuration logic when the game initializes:

Total PlayersWolvesDoctorsDetectivesCivilians 61113 71114 82114 92115 103115 113215 123216 134216 144226 155226

3. Game Flow & Operator Logic

Phase 1: Lobby & Authentication

Auth: Users sign up/in using a unique Username, Phone Number, and Password. They choose an avatar from a pre-set carousel.

Room Creation & Joining: A host creates a room, generating a unique code. Players join and click "Ready".

Auto-Start: Once all players in the room are set to is_ready = true and total player count is between 6 and 15, the operator transitions the game state to IN_PROGRESS.

Phase 2: Role Distribution (Night Start)

The operator automatically shuffles and assigns roles based on the matrix above.

Each player sees a private modal displaying only their card and role. No other player's role is visible.

Once every player taps an "I've Seen My Card" confirmation button, the game triggers Night Phase 1.

Phase 3: Night Action Sequence

The Wolves (30 Seconds):

All players with the WOLF role are added to a secure, anonymous private chat channel (WOLF_PRIVATE).

Messages do not show sender names or typing indicators.

Wolves discuss and vote on a target number/player. Majority vote (or final consensus before the 30-second timer expires) locks in the wolf_target_user_id.

The Detective (Asynchronous / Private):

The detective opens a private chat with the Operator.

The detective selects a target player.

The operator instantly replies privately with "Yes" (if the target is a Wolf) or "No" (if the target is anything else).

The detective's identity remains completely hidden.

The Doctor:

The operator sends a private prompt asking: "Who do you want to heal?"

The doctor can choose themselves (tracked via self_heal_used = false; can only happen once per game) or choose any other living player.

Locks in doctor_target_user_id.

Phase 4: Night Resolution & Morning Announcement

The operator evaluates the night actions:

If wolf_target_user_id == doctor_target_user_id, the target is saved.

If the doctor targeted themselves and the wolves targeted them, it counts as a successful self-heal (allowed only once).

Global Broadcast by Operator: The main group chat opens, and the operator announces:

“THE WOLFS CAME LAST NIGHT, AND THEY KILLED [PLAYER NAME].” followed dynamically by:

If saved: “BUT THE DOCTOR SAVED HIM!”

If not saved: “SADLY THE DOCTOR DID NOT SAVE HIM.”

If not saved, that player's card flips open to everyone, their status updates to is_alive = false, and they transition to spectator mode (they can watch and read, but cannot type or speak).

Phase 5: Analysis & Defense Phase (1 Minute per Living Player)

Each living player sequentially gets a 1-minute timer to speak, accuse, or defend themselves.

During their turn, the player can choose to:

Record Audio: Press record to drop a voice note into the global chat that everyone can play.

Pass: Click "Pass" to instantly skip their remaining time and move to the next player.

Wolves, doctors, and detectives can all speak, lie, or accuse like regular civilians while keeping their hidden roles secret. Dead players cannot participate.

Phase 6: Day Voting & Elimination

A 1-minute voting timer starts.

All living players select a target to eliminate. Players can change their vote freely until the 1-minute timer hits zero. Live vote indicators show who is being voted for.

When time expires, the player with the highest number of votes is eliminated.

Their card is revealed to everyone, and their status changes to is_alive = false (spectator mode).

Phase 7: Win Condition Check

Wolves Win: If the number of living wolves \ge the number of living townspeople (Civilians + Doctors + Detectives).

Town Wins: If all wolves are eliminated (is_alive = false for all wolves).

If neither condition is met, the game loops back to Phase 3 (Next Night Round).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://the-mafia-game.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3ab01683-7e1c-407d-a32e-70361ee70a4e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
