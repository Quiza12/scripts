const fs = require("fs");
const { removeStopwords, eng } = require("stopword");

const decoder = new TextDecoder("utf-8");

let path = "message-files/qc-messages-export-24072026.json"; // Path to your Facebook message JSON file
if (process.argv[2]) {
    path = process.argv[2]; // Override path if passed in as an argument
}

// Only messages within this range (inclusive) are processed. Use null to leave a side unbounded.
// Handy when a single message file spans a longer period than you want to analyze.
const START_DATE = "2026-01-01"; // e.g. "2025-01-01"
const END_DATE = "2026-06-30"; // e.g. "2026-06-30"

const startTimestamp = START_DATE ? new Date(START_DATE).getTime() : null;
// Add a day so END_DATE is treated as inclusive of the whole day.
const endTimestamp = END_DATE ? new Date(END_DATE).getTime() + 24 * 60 * 60 * 1000 : null;

const CONFIG = {
    wordDerivations: ["trot", "teutt", "fuck", "slug", "scruff", "harro", "homm", "niff", "fkn", "coff", "beer", "retard", "pub", "errand", "nips", "cunt", "albo", "lgbt", "sex", "yh", "hmug"],
    keyWords: ["yo", "bro", "fuck"],
    maxResultsPrintCount: 10,
    maxIndividualMessageReactionPrintCount: 5,
    maxMessagePreviewLength: 200,
    noLimit: 1000
};

const SECTION_ORDER = ["General Stats", "Leaderboards", "Words", "Reactions", "Images and Links", "Nicknames"];

const raw = fs.readFileSync(path, "utf8");
const data = JSON.parse(raw);

const chatName = data.title;
const resultsFile = "results/" + chatName.toLowerCase() + "-results.txt";

if (startTimestamp !== null || endTimestamp !== null) {
    data.messages = data.messages.filter(msg =>
        (startTimestamp === null || msg.timestamp_ms >= startTimestamp) &&
        (endTimestamp === null || msg.timestamp_ms < endTimestamp)
    );
}

const totalMessageCount = data.messages.length;
const latestMessageDate = new Date(data.messages[0].timestamp_ms).toLocaleDateString();
const oldestMessageDate = new Date(data.messages[totalMessageCount - 1].timestamp_ms).toLocaleDateString();

const messageReactionRegex = /^.+\sreacted\s.+\sto\syour\smessage/;
const punctuationExcludeRegex = /[._?!@,’"“”*¿():'\-\n\r…²³⁴⁵\#\&\|\|]/g;
const linkExcludeRegex = /https.+/;
const otherNicknameChangeRegex = /^(.+?) set the nickname for (.+?) to (.+)\.$/;
const selfNicknameChangeRegex = /^You set your nickname to (.+)\.$/;

// ---------- Shared helpers ----------

function decodeFacebookString(str) {
    // First try to fix double-encoded UTF-8
    try {
        const bytes = new Uint8Array([...str].map(c => c.charCodeAt(0)));
        const decoded = decoder.decode(bytes);
        // If decoding produced valid UTF-8, return it
        if (!decoded.includes("â")) return decoded;
    } catch (e) { }
    // Otherwise return original
    return str;
}

function stripPunctuation(text) {
    return text.toLowerCase().replace(punctuationExcludeRegex, "");
}

function cleanWords(text) {
    return removeStopwords(stripPunctuation(text).split(" "), eng).filter(w => w !== "");
}

// Decodes + classifies each message exactly once, then hands the result to every analyzer.
function enrichMessage(msg) {
    const sender = msg.sender_name != null ? decodeFacebookString(msg.sender_name) : msg.sender_name;
    const content = msg.content != null ? decodeFacebookString(msg.content) : undefined;
    const isNotification = content != null && messageReactionRegex.test(content);
    const isLink = content != null && linkExcludeRegex.test(content);
    return {
        raw: msg,
        sender,
        content,
        isCountableText: content != null && !isNotification && !isLink,
        timestamp: msg.timestamp_ms,
    };
}

function formatSimpleMap(map, limit = CONFIG.maxResultsPrintCount) {
    return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join("\n");
}

// Shared shape for "counts grouped by sender" maps (Map<sender, Map<key, count>>):
// blank line + sender name, then each entry as its own "- key: count" line, sorted desc.
function formatGroupedCounts(groupedMap, limit = CONFIG.maxResultsPrintCount) {
    let out = "";
    groupedMap.forEach((countMap, groupKey) => {
        out += `\n${groupKey}\n`;
        Array.from(countMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .forEach(([key, count]) => {
                out += ` - ${key}: ${count}\n`;
            });
    });
    return out;
}

function formatIndividualFavouriteWords(individualWordsMap) {
    return formatGroupedCounts(individualWordsMap);
}

function formatFavouriteReactionsPerSender(favouriteReactionsPerSenderMap) {
    return formatGroupedCounts(favouriteReactionsPerSenderMap);
}

function formatBiggestFans(biggestFansMap) {
    return formatGroupedCounts(biggestFansMap);
}

function truncateMessage(message, limit = CONFIG.maxMessagePreviewLength) {
    const singleLine = message.replace(/\s*\n+\s*/g, " ").trim();
    return singleLine.length > limit ? singleLine.slice(0, limit) + "..." : singleLine;
}

function formatMessageReactions(individualReactionsMap) {
    const grouped = new Map();
    Array.from(individualReactionsMap.values())
        .sort((a, b) => (a.sender < b.sender ? -1 : a.sender > b.sender ? 1 : b.reactions - a.reactions))
        .forEach(entry => {
            if (!grouped.has(entry.sender)) grouped.set(entry.sender, []);
            grouped.get(entry.sender).push(entry);
        });

    let out = "";
    grouped.forEach((list, sender) => {
        out += `\n${sender}\n`;
        list.slice(0, CONFIG.maxIndividualMessageReactionPrintCount).forEach(entry => {
            if (entry.reactions > 1) out += ` - ${entry.reactions} reactions - ${truncateMessage(entry.message)}\n`;
        });
    });
    return out;
}

function formatWordDerivations(wordDerivationsMap) {
    let out = "";
    wordDerivationsMap.forEach((value, key) => {
        out += ` - ${key} - Total count: ${value.count} - Derivations: ${value.words.sort().join(", ")}\n`;
    });
    return out;
}

function formatNicknameChanges(nicknamesMap) {
    return Array.from(nicknamesMap.entries())
        .sort((a, b) => new Date(a[0]) - new Date(b[0]))
        .map(([, value]) => ` - ${value.simpleDate} - ${value.modifier} to ${value.target} - New Nickname: ${value.nickname}`)
        .join("\n");
}

function formatMostWordMentions(mentionsMap) {
    const groups = new Map();
    mentionsMap.forEach((value, key) => {
        if (!groups.has(value.word)) groups.set(value.word, []);
        groups.get(value.word).push({ key, count: value.count });
    });

    let out = "";
    groups.forEach((items, word) => {
        items.sort((a, b) => b.count - a.count);
        out += `\n=== ${word} ===\n`;
        items.forEach(item => { out += ` - ${item.key}: ${item.count}\n`; });
    });
    return out;
}

// ---------- Analyzers ----------
// Each analyzer is a self-contained stat category. Contract:
//   process(msg) required — msg is the enriched message from enrichMessage()
//   init(participants) optional — seed state before any messages are processed
//   finalize() optional — runs once after all messages, for stats that need a second pass
//   report() required — returns [{ section, title, body }, ...]; section groups it under
//     one of SECTION_ORDER's headings in the output (add a new heading there if needed)
// To add a new category of analysis, add a new analyzer object to the array below —
// nothing else in the file needs to change.

const generalStatsAnalyzer = {
    totalMessages: 0,
    totalReactions: 0,
    messageCountMap: new Map(),
    reactionCountMap: new Map(),
    metaAiUsageCountMap: new Map(),

    init(participants) {
        participants.forEach(p => {
            const name = decodeFacebookString(p.name);
            this.messageCountMap.set(name, 0);
            this.reactionCountMap.set(name, 0);
        });
    },
    process(msg) {
        this.totalMessages++;
        this.messageCountMap.set(msg.sender, (this.messageCountMap.get(msg.sender) || 0) + 1);
        if (msg.raw.reactions) {
            msg.raw.reactions.forEach(r => {
                this.totalReactions++;
                const actor = decodeFacebookString(r.actor);
                this.reactionCountMap.set(actor, (this.reactionCountMap.get(actor) || 0) + 1);
            });
        }
        if (msg.content && msg.content.includes("@Meta AI")) {
            this.metaAiUsageCountMap.set(msg.sender, (this.metaAiUsageCountMap.get(msg.sender) || 0) + 1);
        }
    },
    report() {
        return [
            { section: "General Stats", title: "", body: `Total messages: ${this.totalMessages}\nTotal reactions: ${this.totalReactions}` },
            { section: "Leaderboards", title: "Message Leaderboard (total messages count)", body: formatSimpleMap(this.messageCountMap, CONFIG.noLimit) },
            { section: "Leaderboards", title: "Reactions Leaderboard (total reaction counts)", body: formatSimpleMap(this.reactionCountMap, CONFIG.noLimit) },
            { section: "Leaderboards", title: `Skynet Simps (total Meta AI usage)`, body: formatSimpleMap(this.metaAiUsageCountMap, CONFIG.noLimit) },

        ];
    },
};

const wordStatsAnalyzer = {
    wordsMap: new Map(),
    individualWordsMap: new Map(),
    wordDerivationsMap: new Map(),
    process(msg) {
        if (!msg.isCountableText) return;
        cleanWords(msg.content).forEach(word => {
            this.wordsMap.set(word, (this.wordsMap.get(word) || 0) + 1);

            if (!this.individualWordsMap.has(msg.sender)) {
                this.individualWordsMap.set(msg.sender, new Map([[word, 1]]));
            } else {
                const words = this.individualWordsMap.get(msg.sender);
                words.set(word, (words.get(word) || 0) + 1);
            }
        });
    },
    finalize() {
        CONFIG.wordDerivations.forEach(wd => {
            const entry = { words: [], count: 0 };
            this.wordsMap.forEach((count, word) => {
                if (word.includes(wd)) {
                    entry.words.push(word);
                    entry.count += count;
                }
            });
            this.wordDerivationsMap.set(wd, entry);
        });
    },
    report() {
        return [
            { section: "Words", title: `Favourite Words of entire chat (top ${CONFIG.maxResultsPrintCount} only)`, body: formatSimpleMap(this.wordsMap) },
            { section: "Words", title: `Word Derivations (i.e. to -> to, total, toe) - (${CONFIG.wordDerivations.join(", ")})`, body: formatWordDerivations(this.wordDerivationsMap) },
            { section: "Words", title: `Individual's Favourite Words (top ${CONFIG.maxResultsPrintCount} only)`, body: formatIndividualFavouriteWords(this.individualWordsMap) },
        ];
    },
};

const keyWordMentionsAnalyzer = {
    mentionsMap: new Map(),
    process(msg) {
        if (!msg.isCountableText) return;
        const cleaned = stripPunctuation(msg.content);
        CONFIG.keyWords.forEach(kw => {
            if (!cleaned.includes(kw)) return;
            const key = `${msg.sender}: ${kw}`;
            const existing = this.mentionsMap.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                this.mentionsMap.set(key, { word: kw, count: 1 });
            }
        });
    },
    report() {
        return [{ section: "Words", title: `Most Key Word Mentions - (${CONFIG.keyWords.join(", ")})`, body: formatMostWordMentions(this.mentionsMap) }];
    },
};

const reactionStatsAnalyzer = {
    reactionsMap: new Map(),
    individualReactionsMap: new Map(),
    highestIndividualReactionsMap: new Map(),
    favouriteReactionsPerSenderMap: new Map(),
    biggestFansMap: new Map(),

    process(msg) {
        if (!msg.raw.reactions) return;

        msg.raw.reactions.forEach(r => {
            const reaction = decodeFacebookString(r.reaction);
            const actor = decodeFacebookString(r.actor);
            this.reactionsMap.set(reaction, (this.reactionsMap.get(reaction) || 0) + 1);

            // Favourite reactions per sender
            if (!this.favouriteReactionsPerSenderMap.has(actor)) {
                this.favouriteReactionsPerSenderMap.set(actor, new Map([[reaction, 1]]));
            } else {
                const reactions = this.favouriteReactionsPerSenderMap.get(actor);
                reactions.set(reaction, (reactions.get(reaction) || 0) + 1);
            }

            // Biggest fans per sender
            if (!this.biggestFansMap.has(msg.sender)) {
                this.biggestFansMap.set(msg.sender, new Map([[actor, 1]]));
            } else {
                const fans = this.biggestFansMap.get(msg.sender);
                fans.set(actor, (fans.get(actor) || 0) + 1);
            }
        });

        if (msg.isCountableText && msg.sender !== "Meta AI") {
            this.individualReactionsMap.set(msg.timestamp, {
                sender: msg.sender,
                message: msg.content,
                reactions: msg.raw.reactions.length,
            });
        }
    },
    finalize() {
        this.individualReactionsMap.forEach(entry => {
            const current = this.highestIndividualReactionsMap.get(entry.sender);
            if (current === undefined || current < entry.reactions) {
                this.highestIndividualReactionsMap.set(entry.sender, entry.reactions);
            }
        });
    },
    report() {
        return [
            { section: "Reactions", title: "Top Chat Reactions", body: formatSimpleMap(this.reactionsMap) },
            { section: "Reactions", title: "Individual's Most Reacted Message", body: formatSimpleMap(this.highestIndividualReactionsMap) },
            { section: "Reactions", title: `Individual's Most Reacted Messages (top ${CONFIG.maxIndividualMessageReactionPrintCount}) only`, body: formatMessageReactions(this.individualReactionsMap) },
            { section: "Reactions", title: `Individual's Favourite Reactions (top ${CONFIG.maxResultsPrintCount}) only`, body: formatFavouriteReactionsPerSender(this.favouriteReactionsPerSenderMap) },
            { section: "Reactions", title: `Individual's Biggest Fans (top ${CONFIG.maxResultsPrintCount}) only`, body: formatBiggestFans(this.biggestFansMap) },

        ];
    },
};

const sharedMediaAnalyzer = {
    sharedImagesMap: new Map(),
    sharedLinksMap: new Map(),
    process(msg) {
        if (msg.raw.photos) {
            this.sharedImagesMap.set(msg.sender, (this.sharedImagesMap.get(msg.sender) || 0) + msg.raw.photos.length);
        }
        if (msg.raw.share) {
            this.sharedLinksMap.set(msg.sender, (this.sharedLinksMap.get(msg.sender) || 0) + 1);
        }
    },
    report() {
        return [
            { section: "Images and Links", title: "Images Leaderboard (total images count)", body: formatSimpleMap(this.sharedImagesMap) },
            { section: "Images and Links", title: "Links Leaderboard (total links shared)", body: formatSimpleMap(this.sharedLinksMap) },
        ];
    },
};

const nicknameChangeAnalyzer = {
    nicknamesMap: new Map(),
    process(msg) {
        if (!msg.content) return;
        const otherMatch = msg.content.match(otherNicknameChangeRegex);
        const selfMatch = msg.content.match(selfNicknameChangeRegex);
        if (!otherMatch && !selfMatch) return;

        const timestampKey = new Date(msg.timestamp).toISOString();
        const simpleDate = new Date(msg.timestamp).toLocaleDateString();
        if (otherMatch) {
            this.nicknamesMap.set(timestampKey, { modifier: msg.sender, target: otherMatch[2], nickname: otherMatch[3], simpleDate });
        } else {
            this.nicknamesMap.set(timestampKey, { modifier: msg.sender, target: msg.sender, nickname: selfMatch[1], simpleDate });
        }
    },
    report() {
        return [{ section: "Nicknames", title: "Nickname Changes", body: formatNicknameChanges(this.nicknamesMap) }];
    },
};

const analyzers = [
    generalStatsAnalyzer,
    wordStatsAnalyzer,
    keyWordMentionsAnalyzer,
    reactionStatsAnalyzer,
    sharedMediaAnalyzer,
    nicknameChangeAnalyzer,
];

// ---------- Engine ----------

function printSectionBreak(sectionName) {
    return `\n==================== ${sectionName} ====================\n`;
}

function run() {
    analyzers.forEach(a => a.init && a.init(data.participants));

    data.messages.forEach(msg => {
        const enriched = enrichMessage(msg);
        analyzers.forEach(a => a.process(enriched));
    });

    analyzers.forEach(a => a.finalize && a.finalize());

    const blocksBySection = new Map(SECTION_ORDER.map(s => [s, []]));
    analyzers.forEach(a => {
        a.report().forEach(block => {
            if (!blocksBySection.has(block.section)) blocksBySection.set(block.section, []);
            blocksBySection.get(block.section).push(block);
        });
    });

    let out = "============================================================\n\n";
    out += `${chatName} Message Stats\n\n`;
    out += `${oldestMessageDate} to ${latestMessageDate}\n`;

    blocksBySection.forEach((blocks, section) => {
        if (blocks.length === 0) return;
        out += printSectionBreak(section);
        blocks.forEach(b => {
            out += `${b.title}\n${b.body}\n\n`;
        });
    });

    console.log(out);
    fs.writeFileSync(resultsFile, out);
}

run();
