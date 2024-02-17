const fs = require('fs');

const fileName = 'log.txt'; // Nama file yang akan dibaca dan ditulis

function write(content) {
    // Baca isi file
    let fileContent = '';

    try {
        fileContent = fs.readFileSync(fileName, 'utf8');
    } catch (err) {
        process.exit(1);
    }

    // Tambahkan isi baru
    const newContent = content + ".\n";
    fileContent += newContent;

    // Tulis kembali ke file
    try {
        fs.writeFileSync(fileName, fileContent, 'utf8');
    } catch (err) {
        process.exit(1);
    }

}

module.exports = write;