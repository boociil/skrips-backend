const express = require('express');
var db = require('./dbconn');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3001;
const secretKey = 'secretKey';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

////////////////////////////////////////////////////////////////////
//FUNCTION
////////////////////////////////////////////////////////////////////

// MASI BELUM BISA DIPAKAI
// Fungsi untuk check username, biar nanti lebih mudah
function check_username(username) {
    var list_usrnm;
    query = 'SELECT `username` FROM `users`';
    db.query(query , (err,results) =>{
        if (err) throw err;
        const hasil = results;
        list_usrnm = hasil.map(hasil => hasil.username);
    })
    console.log(list_usrnm);
    console.log(username);
    list_usrnm.includes(username);
}

// Autentikasi User di cek menggunakan fungsi ini
function autentication(token) {

    // Check Token disini
    
}

//END OF FUNCTION//////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////
// GET 
////////////////////////////////////////////////////////////////////

app.get("/", (req,res) => {
    res.send("Hello world");
});

//END OF GET//////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////
// POST
////////////////////////////////////////////////////////////////////

// API Check Username sudah ada atau belum di database
app.post("/check_username/:usrnm", (req,res) =>{
    query = 'SELECT `username` FROM `users`';
    db.query(query , (err,results) =>{
        const usrnm = req.params.usrnm;
        const hasil = results;
        const list_usrnm = hasil.map(hasil => hasil.username);
        res.status(200).send(list_usrnm.includes(usrnm));
    })
});

// API Register User baru
app.post("/register", async (req,res) =>{

    try{
        const { username, password, firstName, lastName, gender, role, status } = req.body;
        const hashedPass = await bcrypt.hash(password, 10);

        console.log('Username :', username);
        console.log('Password :', password);
        console.log('hashedPassword :', hashedPass);
        console.log('gender : ', gender);
        console.log('firstName : ', firstName);
        console.log('lastName : ', lastName);
        console.log('role : ', role);
        console.log('status : ', status);

        //Push ke db
        query = "INSERT INTO `users` (`username`, `firstName`, `lastName`, `pass`, `role`, `status`, `created_at`) VALUES ('" + username + "', '" + firstName + "', '" + lastName + "', '" + hashedPass +"', '" + role + "', '" + status + "', current_timestamp());"
        db.query(query, (err,results) => {
            if (err) throw err;
            //var error_message = err.message.slice(0,12);
            //res.status(404).send(error_message)
            //if (error_message = "ER_DUP_ENTRY"){
                //res.status(404).send("DUP_ENTRY");
            //    console.log(error_message);
            //}

        });

        res.status(201).send("Berhasil");
    } catch(error){
        res.status(500).send("Terjadi Kesalahan")
    }
    
})

// API Login
app.post("/login", async (req,res) => {
    try {
        const { username, password } = req.body;

        query = 'SELECT `username`,`pass` FROM `users` WHERE `username`= "' + username + '";';
        db.query(query, (err,results) =>{
            res.send("Username ditemukan")
            if (err) throw err;
            res.status(500).send(err.message);
        });
    } catch (error) {
        res.status(500).send("Terjadi Kesalahan")
    }
});

// API Register Kegiatan Baru
app.post("/add_kegiatan", async (req,res) => {

    // Autentikasi User dulu, apakah bisa menambahkan kegiatan baru atau tidak

    try{
        const { id, nama, jenis, metode, initiator_id, status, target_selesai, koseka, target_pengdok, target_edcod, target_entri } = req.body;
        const hashedPass = await bcrypt.hash(password, 10);

        console.log('Id :', id);
        console.log('nama :', password);
        console.log('jenis :', hashedPass);
        console.log('metode : ', gender);
        console.log('initiator_id : ', firstName);
        console.log('status : ', lastName);
        console.log('target_selesai : ', role);
        console.log('koseka : ', status);
        console.log('target_pengdok : ', target_pengdok);
        console.log('target_edcod : ', target_edcod);
        console.log('target_entri : ', target_entri);

        //Push ke db
        query = "INSERT INTO `kegiatan` (`id`, `nama`, `jenis`, `metode`, `initiator_id`, `status`, `taget_selesai`, `koseka`, `target_pengdok`, `target_edcod`, `target_entri`, `created_at`) VALUES ('" + id +"', '" + nama +"', '" + jenis +"', '" + metode + "', '" + initiator_id +"', '" + status +"', '" + target_selesai + "', '" + koseka + "', '" + target_pengdok + "', '" + target_edcod + "', '" + target_entri + "', current_timestamp());"
        db.query(query, (err,results) => {
            if (err) throw err;
            //var error_message = err.message.slice(0,12);
            //res.status(404).send(error_message)
            //if (error_message = "ER_DUP_ENTRY"){
                //res.status(404).send("DUP_ENTRY");
            //    console.log(error_message);
            //}

        });

        res.status(201).send("Berhasil");
    } catch(error){
        res.status(500).send("Terjadi Kesalahan")
    }
});

//END OF POST//////////////////////////////////////////////////

app.listen(port, () => console.log(`Program berjalan di http://localhost:${port}`))
