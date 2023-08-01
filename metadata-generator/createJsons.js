const fs = require('fs-extra');
const path = require('path');
const { inputs } = require('./inputs.js');
console.log(inputs);

const updateImageFolderOnJsonFile = async () => {
    console.log('💮 💮 💮 💮  PARSING! 💮 💮 💮 💮');
    let totalUpdates = 0;

    const totalFiles = inputs.TOTAL_SUPPLY + inputs.STARTING_ID;
    for (let i = inputs.STARTING_ID; i < totalFiles; i++) {
        // Create the json as an object, then add it to a file:
        const json = {
            name: `${inputs.COLLECTION_NAME} #${i}`,
            animation_url: `${inputs.IMG_IPFS_URL}/${i}.jpeg`,
            external_link: '',
            image: `${inputs.IMG_IPFS_URL}/${i}.jpeg`,
            description: inputs.description,
        };

        // Create a new file
        const fileName = `${i}`;
        if (!fs.existsSync(inputs.OUTPUT_FOLDER)) {
            fs.mkdirSync(inputs.OUTPUT_FOLDER);
        }
        const filePath = path.join(inputs.OUTPUT_FOLDER, fileName);

        await fs.writeFile(filePath, JSON.stringify(json), { flag: 'w' });

        totalUpdates++;

        console.log(`(${i}) —— Created ${fileName}`);
    }
};

updateImageFolderOnJsonFile();
