const express = require('express');
var db = require('./dbconn');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3001;
const secretKey = 'secretKey';
const salt = 10

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

////////////////////////////////////////////////////////////////////
//FUNCTION
////////////////////////////////////////////////////////////////////

// MASI BELUM BISA DIPAKAI
// Fungsi untuk check username, biar nanti lebih mudah
function check_username(username) {
    return new Promise((resolve, reject) => {
        query = "SELECT * FROM `users` WHERE username = '" + username + "';";
        db.query(query , (err,results) => {
            if (err) {
                reject(err);
            }else{
                const l = results.length
                console.log("Total username ada di database : " + l);
                console.log("l : " + l);
                resolve(l);
            }
        });
    }); 
}

function users_log_activiy(username, activity) {
    
}

function set_login(username) {
    
    try {
        query = "UPDATE `users` SET `status` = '1' WHERE `users`.`username` = '" + username +"'; ";
        db.query(query, (err,results) => {
            if (err) throw err;

            // ATUR SESSION DISINI

            // Masukan kedalam Log
        });
    } catch (error) {
        return "Gagal tersambung";
    }
    

}

// Autentikasi User di cek menggunakan fungsi ini
// Contoh middleware untuk verifikasi token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, secretKey, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.user = user;
        if (user.role == 'admin'){
            next();
        }else{
            res.sendStatus(403); // Forbidden
        }
    });
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
    const usrnm = req.params.usrnm;
    check_username(usrnm).then(l => {
        if(l == 0){
            // Username diperbolehkan atau tidak ada duplikasi
            res.status(200).send("True")
        }else{
            // Username tidak diperbolehkan karena ada duplikasi
            res.status(200).send("False");
        }
    });
});

// API Register User baru
app.post("/register", authenticateToken, async (req,res) =>{
    console.log(req.user);
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
            res.status(403).send(err);
        });

        res.status(201).send("Berhasil");
    } catch(error){
        res.status(500).send("Terjadi Kesalahan")
    }
    
})

// API Login
app.post("/login", (req,res) => {

    try {

        const { username, password } = req.body;

        query = 'SELECT username,firstName,lastName,gender,role,pass FROM `users` WHERE `username`= "' + username + '";';
        db.query(query, (err,results) =>{
            if (!results.length){
                res.status(400).send("username tidak ditemukan");
            }else{
                let hashed_pass = results[0].pass;
                bcrypt.compare(password, hashed_pass, function(err,resultss){
                    if (err) {
                        // Kesalahan selama pembandingan
                        console.error('Error during password comparison:', err);
                    } else {
                        // Hasil pembandingan
                        if (resultss) {
                            // Informasi yang terkandung dalam token
                            const info = {
                                "username": results[0].username,
                                "firstName": results[0].firstName,
                                "lastName": results[0].lastName,
                                "gender": results[0].gender,
                                "role": results[0].role,
                            }
                            // TOKEN
                            const token = jwt.sign(info,secretKey);
                            console.log("Login berhasil");
                            res.status(200).json({
                                accessToken : token
                            })
                        } else {
                            res.status(200).send("password salah");
                        }
                    }
                });
            }
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

        console.log('Id :', id);
        console.log('nama :', nama);
        console.log('jenis :', jenis);
        console.log('metode : ', metode);
        console.log('initiator_id : ', initiator_id);
        console.log('status : ', status);
        console.log('target_selesai : ', target_selesai);
        console.log('koseka : ', koseka);
        console.log('target_pengdok : ', target_pengdok);
        console.log('target_edcod : ', target_edcod);
        console.log('target_entri : ', target_entri);

        //Push ke db
        query = "INSERT INTO `kegiatan` (`id`, `nama`, `jenis`, `metode`, `initiator_id`, `status`, `taget_selesai`, `koseka`, `target_pengdok`, `target_edcod`, `target_entri`, `created_at`) VALUES ('" + id +"', '" + nama +"', '" + jenis +"', '" + metode + "', '" + initiator_id +"', '" + status +"', '" + target_selesai + "', '" + koseka + "', '" + target_pengdok + "', '" + target_edcod + "', '" + target_entri + "', current_timestamp());"
        db.query(query, (err,results) => {
            if (err) throw err;
        });

        res.status(201).send("Berhasil");
    } catch(error){
        res.status(500).send("Terjadi Kesalahan")
    }
});

app.post("/update_kegiatan", (req,res) => {

    try {
        const { id, nama, jenis, metode, initiator_id, status,tanggal_mulai, target_selesai, koseka, target_pengdok, target_edcod, target_entri } = req.body;
        query = "UPDATE `kegiatan` SET `jenis` = '" + jenis + "', `metode` = '" + metode + "', `initiator_id` = '" + initiator_id + "', `status` = '" + status + "',`tanggal_mulai` = '" + tanggal_mulai +"', `target_selesai` = '" + target_selesai + "', `koseka` = '" + koseka + "', `target_pengdok` = '" + target_pengdok + "', `target_edcod` = '" + target_edcod + "', `target_entri` = '" + target_entri +"' WHERE `kegiatan`.`id` = '" + id + "' ";
        db.query(query, (err,results) => {
            if (err) throw err;
            res.status(200).send(results);
        })
    } catch (error) {
        
    }
});

app.post("/delete_user/:usrnm", authenticateToken, (req,res) =>{

    // Autentikasi User
    try {
        const usrnm = req.params.usrnm;
        query = "DELETE FROM `users` WHERE username = '" + usrnm + "';";
        //query = "SELECT * FROM USERS";
        db.query(query , (err,results) =>{
            if(err) throw err;
            const a = results;
            res.status(200).send("Hapus Users " + usrnm + " Berhasil");     
        })
    } catch (error) {
        res.sendStatus(500);
    }
    
});

app.post("/delete_kegiatan/:id_kegiatan", (req,res) => {

    // Autentikasi User

    const id = req.params.id_kegiatan;
    query = "DELETE FROM `kegiatan` WHERE id = '" + id + "';";
    //query = "SELECT * FROM USERS";
    db.query(query , (err,results) =>{
        if(err) throw err;
        const a = results;
        res.status(200).send("Hapus kegiatan " + id + " Berhasil");     
    })
});

app.post("/get_all_kegiatan", (req,res) => {
    query = "SELECT nama,id,tanggal_mulai,status,metode FROM `kegiatan`;";
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    })
})

app.post("/get_all_mitra", (req,res) => {
    query = "SELECT nama,status,start_contract, end_contract FROM `mitra`;";
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    })
})


//END OF POST//////////////////////////////////////////////////

app.listen(port, () => console.log(`Program berjalan di http://localhost:${port}`))
