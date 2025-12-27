# Facebook Messenger Stats 
Get the rundown of your Facebook group chat stats with this script.

## Instructions
1. Follow the instructions on [Request a copy of your Messenger data](https://www.facebook.com/help/messenger-app/713635396288741/Download+a+copy+of+your+information+on+Messenger/)
2. Clone or download this project, and run `npm install`.
    - There is only one package required: [stopwords](https://www.npmjs.com/package/stopword)
3. Update the `path` variable in the script, or parse in the path as the only argument to the script (i.e. `node fb-messenger-stats.js my-message-group.json`).
4. Run the script with `node fb-messenger-stats.js` (or with an argument as per #3).
5. See your results in the generated text file or in the console!

## Tips
- Facebook may export your messages in multiple files - if this is the case, combine the messages array into one JSON file.
- Update the wordDerivations array with the words you would like to see the derivations of (i.e. to = to, tomato, tom, toblerone)
- Play with the `wordMaxConsolePrint`, `maxFileAndConsoleOutput` and `maxIndividualFaveMessageOutput` variables to tweak how many of the top words are displayed (as this list can be large and can blow out the console logs/results file).
