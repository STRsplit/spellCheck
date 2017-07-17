const linebyline = require('linebyline');
const fs = require('fs');
const Typo = require('typo-js');

const dictionary = new Typo('en_US');
const location = __dirname + '/testFiles';

const getLineText = (textline) => {
  return textline.replace(/^\s+|\s+$/g, '')
  .replace(/[,.;!?:/)(\d]+/g, ' ')
  .replace(/\s\s+/g, ' ')
  .replace(/<(?:[^>=]|='[^']*'|="[^"]*"|=[^'"][^\s>]*)*>/g, '');
};

const readFileInfo = (directory) => {
  return new Promise((resolve, reject) => {
    fs.readdir(location, (err, files) => {
      if(err) reject(err);
      else {
        const storage = {};
        files.forEach(file => {
          storage[file] = new Map();
          const rl = linebyline(`${directory}/${file}`);
          rl.on('line', (line, lineCount) => {
            const textBlock = getLineText(line, '<p>');
            if(textBlock.length){
              storage[file].set(lineCount, textBlock);
            }
          });
          rl.on('end', () => {
            resolve(storage);
          });
        });
      }
    });
  });
};

const checkWords = (wordString) => {
  const allWords = new Set();

  const errorWords = wordString.split(' ').filter(word => {
    if(allWords.has(word)){
      return false;
    }
    allWords.add(word);
    return !dictionary.check(word);
  }).map(word => ({ word, suggestions: dictionary.suggest(word) }));

  return errorWords.length ? errorWords : false;
};

const checkLines = (fileMap) => {
  const errors = [];
  fileMap.forEach((val, key) => {
    const spellError = checkWords(val);
    if(spellError){
      errors.push({
        line: key,
        errors: spellError,
      });
    }
  });
  return errors;
};

const contentByLine = async (directory) => {
  const contentInfo = await readFileInfo(directory);
  const spellCheckPromises = Promise.all(Object.entries(contentInfo).map(([file, text]) => {
    return {
      file,
      issues: checkLines(text),
    };
  }));

  spellCheckPromises.then(data => {
    const errorReport = fs.createWriteStream(`${__dirname}/${Date.now()}.json`, 'utf-8');

    data.forEach(file => {
      errorReport.write(JSON.stringify(file, null, 2));
    });
    errorReport.end(() => console.log('finished'));
  });
};

contentByLine(location)