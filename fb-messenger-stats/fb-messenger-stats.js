const fs = require("fs");
const { removeStopwords, eng } = require('stopword');

let path = "YOUR_FILE.json"; // Path to your Facebook message JSON file 

if (process.argv[2]) {
    path = process.argv[2]; // Override path if parsed in as an argument
}
// Read and parse the JSON 
const raw = fs.readFileSync(path, "utf8");
const data = JSON.parse(raw);

const wordDerivations = ["put", "your", "own", "words", "here"];
const keyWords = ["yo", "bro"];

const chatName = data.title;
const resultsFile = chatName.toLowerCase() + "-results.txt";

const messageReactionRegex = /^.+\sreacted\s.+\sto\syour\smessage/g;
const punctuationExcludeRegex = /[._?!@,’"“”*¿():'\-\n\r…²³⁴⁵\#\&\|\|]/g;
const linkExcludeRegex = /https.+/g;
const otherNicknameChangeRegex = /^(.+?) set the nickname for (.+?) to (.+)\.$/;
const selfNicknameChangeRegex = /^You set your nickname to (.+)\.$/;

const totalMessages = data.messages.length;
const latestMessageDate = new Date(data.messages[0].timestamp_ms).toLocaleDateString();
const oldestMessageDate = new Date(data.messages[totalMessages - 1].timestamp_ms).toLocaleDateString();
const maxResultsPrintCount = 100;
const maxIndividualMessageReactionPrintCount = 15;

let totalReactions = 0;
let resultsOutput = "";
let messageCountMap = new Map();
let reactionCountMap = new Map();
let wordsMap = new Map();
let individualWordsMap = new Map();
let mostKeyWordMentionsMap = new Map();
let reactionsMap = new Map();
let individualReactionsMap = new Map();
let highestIndividualReactionsMap = new Map();
let wordDerivationsMap = new Map();
let sharedImagesMap = new Map();
let sharedLinksMap = new Map();
let nicknamesMap = new Map();

setup();
loopMessages();
results();

function setup() {
    // Initialise maps
    data.participants.forEach(p => {
        let decodedName = decodeFacebookString(p.name);
        messageCountMap.set(decodedName, 0);
        reactionCountMap.set(decodedName, 0);
    });
}

function loopMessages() {
    data.messages.forEach(msg => {
        getGeneralStats(msg);
        getWordStats(msg);
        getMostKeyWordMentions(msg);
        getReactionStats(msg);
        getSharedImageStats(msg);
        getSharedLinkStats(msg);
        getNicknameChanges(msg);
    });
    getHighestReactedForEachIndividual();
    getWordDerivations();
}

function getGeneralStats(msg) {
    // Get overall message count
    let count = messageCountMap.get(msg.sender_name);
    count += 1;
    messageCountMap.set(msg.sender_name, count);

    // Get overall reactions
    if (msg.reactions) {
        msg.reactions.forEach(r => {
            totalReactions++;
            let count = reactionCountMap.get(r.actor)
            count += 1
            reactionCountMap.set(r.actor, count)
        });
    }
}

function processMessageContent(msg) {
    let decodedMessage = decodeFacebookString(msg.content).toLowerCase(); // decode and lowercase
    let punctuationExcludedMessage = decodedMessage.replace(punctuationExcludeRegex, ""); //replace all punctuation
    let wordsInMessage = punctuationExcludedMessage.split(" "); //break up content into individual words
    return wordsInMessageNoStopWords = removeStopwords(wordsInMessage, eng); //remove stopwords (i.e. common words)
}

function getWordStats(msg) {
    if (msg && msg.content && !msg.content.match(messageReactionRegex) && !msg.content.match(linkExcludeRegex)) {
        const wordsInMessageNoStopWords = processMessageContent(msg);
        wordsInMessageNoStopWords.forEach(word => {
            if (word != "") {

                // General word stats
                addToOrUpdateCountMap(wordsMap, word);

                // Individual word stats
                if (!individualWordsMap.get(msg.sender_name)) {
                    individualWordsMap.set(msg.sender_name, new Map());
                } else {
                    const words = individualWordsMap.get(msg.sender_name); // Update count const 
                    current = words.get(word) || 0;
                    words.set(word, current + 1);
                }
            }
        });
    }
}

function getMostKeyWordMentions(msg) {
    if (msg && msg.content && !msg.content.match(messageReactionRegex) && !msg.content.match(linkExcludeRegex)) {

        let cleanMessage = decodeFacebookString(msg.content).toLowerCase().replace(punctuationExcludeRegex, ""); // decode and lowercase, replace all punctuation

        keyWords.forEach(mm => {
            if (cleanMessage.includes(mm)) {
                let key = msg.sender_name + ": " + mm;
                if (mostKeyWordMentionsMap.get(key)) {
                    mostKeyWordMentionsMap.get(key).count += 1;
                } else {
                    mostKeyWordMentionsMap.set(key, { word: mm, count: 1 });
                }
            }
        });


    }
}

function getReactionStats(msg) {
    if (msg && msg.reactions) {
        msg.reactions.forEach(r => {
            let reaction = decodeFacebookString(r.reaction);
            addToOrUpdateCountMap(reactionsMap, reaction);
        });

        if (msg.content && !msg.content.match(messageReactionRegex) && !msg.content.match(linkExcludeRegex) && msg.sender_name != 'Meta AI') {
            let decodedMessage = decodeFacebookString(msg.content);
            individualReactionsMap.set(msg.timestamp_ms, { sender: msg.sender_name, message: decodedMessage, reactions: msg.reactions.length });
        }
    }
}

function getHighestReactedForEachIndividual() {
    individualReactionsMap.forEach(msg => {
        if (!highestIndividualReactionsMap.has(msg.sender) || highestIndividualReactionsMap.get(msg.sender) < msg.reactions) {
            highestIndividualReactionsMap.set(msg.sender, msg.reactions);
        }

    });
}

function getWordDerivations() {
    wordDerivations.forEach(wd => {
        wordDerivationsMap.set(wd, { wds: [], count: 0 });
        wordsMap.forEach((value, key) => {
            if (key.includes(wd)) {
                wordDerivationsMap.get(wd).wds.push(key);
                wordDerivationsMap.get(wd).count += value;
            }
        })
    });
}

function getSharedImageStats(msg) {
    if (msg && msg.photos) {
        if (!sharedImagesMap.get(msg.sender_name)) {
            sharedImagesMap.set(msg.sender_name, msg.photos.length);
        } else {
            let count = sharedImagesMap.get(msg.sender_name);
            count += msg.photos.length;
            sharedImagesMap.set(msg.sender_name, count);
        }
    }
}

function getSharedLinkStats(msg) {
    if (msg && msg.share) {
        addToOrUpdateCountMap(sharedLinksMap, msg.sender_name);
    }
}

function getNicknameChanges(msg) {

    if (msg && msg.content) {
        let cleanMessage = decodeFacebookString(msg.content);
        const otherMatch = cleanMessage.match(otherNicknameChangeRegex);
        const selfMatch = cleanMessage.match(selfNicknameChangeRegex);
        const messageDate = new Date(msg.timestamp_ms).toISOString();
        if (otherMatch) {
            nicknamesMap.set(messageDate, { modifier: msg.sender_name, target: otherMatch[2], nickname: otherMatch[3], simpleDate: new Date(msg.timestamp_ms).toLocaleDateString() });
        } else if (selfMatch) {
            nicknamesMap.set(messageDate, { modifier: msg.sender_name, target: msg.sender_name, nickname: selfMatch[1], simpleDate: new Date(msg.timestamp_ms).toLocaleDateString() });
        }
    }

}

function addToOrUpdateCountMap(map, key) {
    if (!map.get(key)) {
        map.set(key, 1);
    } else {
        let count = map.get(key);
        count += 1
        map.set(key, count)
    }
}

function saveAndPrintResults(content) {
    console.log(content + "\n");
    resultsOutput += content + "\n";
}

function saveAndPrintSimpleMap(map) {
    // Convert Map → array of [key, value]
    const entries = Array.from(map.entries());

    // Sort by key (alphabetically)
    entries.sort((a, b) => b[1] - a[1]);

    // Build output text
    let out = "\n";

    // File
    entries.slice(0, maxResultsPrintCount).forEach(([key, value]) => {
        if (value === undefined) return;
        out += ` - ${key}: ${value}\n`;
    });

    // Write to console/file
    console.log(out + "\n");
    resultsOutput += out + "\n";
}

function saveAndPrintIndividualsFavouriteWords() {
    let out = "";

    individualWordsMap.forEach((wordMap, sender) => {
        out += `\n${sender}\n`;
        // Convert inner map to array so we can sort
        const sorted = Array.from(wordMap.entries())
            .sort((a, b) => b[1] - a[1]); // sort by count desc

        for (let i = 0; i < maxResultsPrintCount; i++) {
            if (sorted[i]) {
                const [word, count] = sorted[i];
                out += ` - ${word}: ${count}\n`;
            }
        }
    });

    saveAndPrintResults(out);
}

function saveAndPrintMessageReactions() {
    // Convert Map → array
    const entries = Array.from(individualReactionsMap.entries());

    // Sort by sender, then by reactions
    entries.sort((a, b) => {
        const A = a[1];
        const B = b[1];

        if (A.sender < B.sender) return -1;
        if (A.sender > B.sender) return 1;

        return B.reactions - A.reactions;
    });

    const grouped = new Map();
    let out = "\n";

    // Group by sender
    for (const [_, data] of entries) {
        if (!grouped.has(data.sender)) {
            grouped.set(data.sender, []);
        }
        grouped.get(data.sender).push(data);
    }

    // Print first ? for each sender
    grouped.forEach((list, sender) => {
        out += `\n${sender}\n`;

        list.slice(0, maxIndividualMessageReactionPrintCount).forEach(data => {
            if (data.reactions > 1) {
                out += `- ${data.reactions} reactions - ${data.message}\n`;
            }
        });
    });

    // Write to file/console
    saveAndPrintResults(out);
}

function saveAndPrintWordDerivations(map) {
    let out = "\n";

    map.forEach((value, key) => {
        const wdsJoined = value.wds.sort().join(", ");
        const line = ` - ${key} - Total count: ${value.count} - Derivations: ${wdsJoined}\n`;
        out += line;
    });

    // Write to console/file
    saveAndPrintResults(out);
}

function saveAndPrintNicknameChanges(map) {
    // Convert Map → array so we can sort it
    const entries = Array.from(map.entries());

    // Sort by date (ascending)
    entries.sort((a, b) => {
        const dateA = new Date(a[0]);
        const dateB = new Date(b[0]);
        return dateA - dateB; // oldest first
    });

    // Build output
    let out = "\n";
    for (const [timestamp, value] of entries) {
        if (value === undefined) continue;
        out += `- ${value.simpleDate} - ${value.modifier} to ${value.target} - New Nickname: ${value.nickname}\n`;
    }

    // Write to console/file
    saveAndPrintResults(out);
}

function saveAndMostWordMentions(map) {
    // Build output
    let out = "";

    // Step 1: Group by the "word" field
    const groups = {};

    for (const [key, value] of map.entries()) {
        const group = value.word;
        if (!groups[group]) groups[group] = [];
        groups[group].push({ key, count: value.count });
    }

    // Step 2: Sort each group by count DESC
    for (const group of Object.keys(groups)) {
        groups[group].sort((a, b) => b.count - a.count);
    }

    // Step 3: Print nicely
    for (const group of Object.keys(groups)) {
        out += `\n=== ${group} ===\n\n`;
        for (const item of groups[group]) {
            out += `${item.key}: ${item.count}\n`;
        }

    }

    // Write to console/file
    saveAndPrintResults(out);
}

function decodeFacebookString(str) {
    // First try to fix double-encoded UTF-8
    try {
        const bytes = new Uint8Array([...str].map(c => c.charCodeAt(0)));
        const decoded = new TextDecoder("utf-8").decode(bytes);

        // If decoding produced valid UTF-8, return it
        if (!decoded.includes("â")) return decoded;
    } catch (e) { }

    // Otherwise return original
    return str;
}

function printSectionBreak(sectionName) {
    return `\n==================== ${sectionName} ====================\n`;
}

function results() {

    saveAndPrintResults(`============================================================\n`);
    saveAndPrintResults(`${chatName} Message Stats`);
    saveAndPrintResults(`${oldestMessageDate} to ${latestMessageDate}`);

    saveAndPrintResults(printSectionBreak(`General Stats`));
    saveAndPrintResults(`Total messages: ${totalMessages}`)
    saveAndPrintResults(`Total reactions: ${totalReactions}`)

    saveAndPrintResults(printSectionBreak(`Leaderboards`));
    saveAndPrintResults(`Message Leaderboard (total messages count)`);
    saveAndPrintSimpleMap(messageCountMap);

    saveAndPrintResults(`Reactions Leaderboard (total reaction counts)`);
    saveAndPrintSimpleMap(reactionCountMap);

    saveAndPrintResults(printSectionBreak(`Words`));
    saveAndPrintResults(`Favourite Words of entire chat (top ${maxResultsPrintCount} only)`);
    saveAndPrintSimpleMap(wordsMap);

    saveAndPrintResults(`Word Derivations (i.e. to -> to, total, toe) - (` + wordDerivations.join(", ") + `)`);
    saveAndPrintWordDerivations(wordDerivationsMap)

    saveAndPrintResults(`Most Key Word Mentions - (` + keyWords.join(", ") + `)`);
    saveAndMostWordMentions(mostKeyWordMentionsMap);

    saveAndPrintResults(`Individual's Favourite Words (top ${maxResultsPrintCount} only)`);
    saveAndPrintIndividualsFavouriteWords();

    saveAndPrintResults(printSectionBreak(`Reactions`));

    saveAndPrintResults(`Favourite Reactions`);
    saveAndPrintSimpleMap(reactionsMap);

    saveAndPrintResults(`Top Individual Message Reaction Count`);
    saveAndPrintSimpleMap(highestIndividualReactionsMap);

    saveAndPrintResults(`Individual's Favourite Message Reactions (top ${maxIndividualMessageReactionPrintCount}) only`);
    saveAndPrintMessageReactions();

    saveAndPrintResults(printSectionBreak(`Images and Links`));

    saveAndPrintResults(`Images Leaderboard (total images count)`);
    saveAndPrintSimpleMap(sharedImagesMap);

    saveAndPrintResults(`Links Leaderboard (total links shared)`);
    saveAndPrintSimpleMap(sharedLinksMap);

    saveAndPrintResults(printSectionBreak(`Nicknames`));

    saveAndPrintResults(`Nickname Changes`);
    saveAndPrintNicknameChanges(nicknamesMap);

    fs.writeFileSync(resultsFile, resultsOutput);
}
