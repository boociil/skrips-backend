const express = require('express');
var db = require('./dbconn');
var write_log = require('./writeLog');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// agar API bisa diakses
const cors = require('cors');

// digunakan untuk endpoint file
const fs = require('fs');
const path = require('path');

const app = express();
// PRODUCTION
// const port = process.env.PORT || 3000
// DEVELOPMENT
const port = 3001
const secretKey = 'secretKey';


const now = new Date();

// Mendapatkan informasi tanggal dan waktu sekarang
const year = now.getFullYear(); // Tahun (misal: 2024)
const month = now.getMonth() + 1; // Bulan (0-11, tambahkan 1 untuk mendapatkan bulan 1-12)
const day = now.getDate(); // Tanggal (1-31)
const hours = now.getHours(); // Jam (0-23)
const minutes = now.getMinutes(); // Menit (0-59)
const seconds = now.getSeconds(); // Detik (0-59)

// Membuat string untuk menampilkan waktu sekarang
const currentTime = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


////////////////////////////////////////////////////////////////////
// ENTRI POINT
////////////////////////////////////////////////////////////////////


// app.use(function(req, res, next) {
//     res.header("Access-Control-Allow-Origin", "http://localhost:3000");
//     res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//     next();
//   });

app.use(cors());
app.use('/static', express.static(path.join(__dirname, 'public')));

////////////////////////////////////////////////////////////////////
//FUNCTION
////////////////////////////////////////////////////////////////////

// Fungsi untuk check username, biar nanti lebih mudah
function check_username(username) {
    return new Promise((resolve, reject) => {
        query = "SELECT * FROM `users` WHERE username = '" + username + "';";
        db.query(query , (err,results) => {
            if (err) {
                reject(err);
            }else{
                const l = results.length
                resolve(l);
            }
        });
    }); 
}

// fungsi delay, digunakan untuk mendelay respons dalam satuan milisecond
// hanya digunakan pada fase development
// penggunaan : delay(ms).then(funcgtion () => { // apa yg dilakukan disini })
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// fungsi untuk mendapatkan informasi suatu kegiatan
async function info(id, callback) {
    query = "SELECT * FROM `kegiatan` WHERE id = '" + id + "';";
    db.query(query, (err,results) => {
        if (err) {
            callback(err, null);
            return;
        }
        callback(null, results);
    })
}

// fungsi untuk mengupdate progres di backend
function update_progres(id, msg){

    const q = {
        "2" : `SELECT (SELECT COUNT(*) FROM survei WHERE id_kegiatan = '${id}' AND status_pengdok = '1') AS rb,
        (SELECT COUNT(*) FROM survei WHERE id_kegiatan = '${id}' AND status_edcod = '1') AS edcod,
        (SELECT COUNT(*) FROM survei WHERE id_kegiatan = '${id}' AND status_entri = '1') AS entri,
        (SELECT COUNT(*) FROM survei WHERE id_kegiatan = '${id}') AS total;`,
        "1" : `SELECT (SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '${id}' AND status_pengdok = '1') AS rb,
        (SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '${id}' AND status_edcod = '1') AS edcod,
        (SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '${id}' AND status_entri = '1') AS entri,
        (SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '${id}') AS total;`
    }

    info(id, (err,results) => {
        if (err) {
            return;
        }else{
            const data = results;
            const jenis = data[0].jenis
            db.query(q[jenis], (err,ress) => {
                if (err) {
                    return;
                }
                if (ress.length === 0) {
                    // berarti tidak ada data
                    // do nothing
                }else{
                    // jika ada data, maka hitung progresnya
                    const sum = ress[0].rb + ress[0].edcod + ress[0].entri;
                    const total = ress[0].total * 3;
                    const persentase = ((sum / total) * 100).toFixed(2);
                    console.log("id: ", id, sum, total, persentase);
                    if (total === 0) {
                        // query ke db untuk update progres kegiatan
                        const q2 = "UPDATE `kegiatan` SET `progres` = '0.00' WHERE `kegiatan`.`id` = '" + id +"'"
                        db.query(q2, (err,ress) => {
                            if (err) throw err;
                            console.log(ress);
                        })
                    } else {
                        const q2 = "UPDATE `kegiatan` SET `progres` = '" + persentase + "' WHERE `kegiatan`.`id` = '" + id +"'"
                        db.query(q2, (err,ress) => {
                            if (err) throw err;
                            console.log(ress);
                        })
                    }
                }
            })
        }
    })
}

// fungsi untuk mengecek progres dari suatu kegiatan
function check_is_finish(id, callback) {
    info(id, (err,results) => {
        if (err) {
            res.sendStatus(500);
        }

        const data = results;
        const jenis = data[0].jenis

        if (jenis === "2"){
            const query = "SELECT * FROM `survei` WHERE id_kegiatan = ? AND ((status_pengdok IS NULL OR 0) OR (status_edcod is NULL OR 0) OR (status_entri is NULL OR 0));";
            db.query(query, [id], (err, results) => {
                if (err) {
                    callback(err, null);
                } else {
                    const l = results.length;
                    if (l === 0) {
                        callback(null, true);
                    } else {
                        callback(null, false);
                    }
                }
            });
        }else{
            const query = "SELECT * FROM `sensus` WHERE id_kegiatan = ? AND ((status_pengdok IS NULL OR 0) OR (status_edcod is NULL OR 0) OR (status_entri is NULL OR 0));";
            db.query(query, [id], (err, results) => {
                if (err) {
                    callback(err, null);
                } else {
                    const l = results.length;
                    if (l === 0) {
                        callback(null, true);
                    } else {
                        callback(null, false);
                    }
                }
            });
        }
    })
    
}

// fungsi untuk mengubah status kegiatan 
function change_stats(id,status) {
    try {
        query = "UPDATE `kegiatan` SET `status` = '" + status +"' WHERE `kegiatan`.`id` = '" + id + "' "
        db.query(query, (err,results) => {
            if (err) throw err;

        });
    } catch (error) {
        console.error(error)
    }
}

// Fungsi untuk mendapatkan progres penerima dok
function get_penerima_dok(id) {
    try {
        const query = "SELECT penerima_dok, COUNT(penerima_dok) as 'TOTAL'FROM survei WHERE id_kegiatan = ? GROUP BY penerima_dok;"
        db.query(query, [id] , (err,results) => {
            if (err) throw err;
            // console.log(JSON.stringify(results));
            return JSON.stringify(results);
        });
    } catch (error) {
        
    }
}

// Fungsi untuk mendapatkan progres petugas edcod
function get_petugas_edcod(id) {
    try {
        const query = " SELECT petugas_edcod, COUNT(petugas_edcod) as 'TOTAL'FROM survei WHERE id_kegiatan = ? GROUP BY petugas_edcod;"
        db.query(query, [id] , (err,results) => {
            if (err) throw err;
            return results;
        })
    } catch (error) {
        
    }
}

// Fungsi untuk mencatat log aktivitas user
function users_log_activiy(username, activity, information = "-") {
    // List Activity User : 
    // LOGIN, LOGOUT, REGISTER NEW USER, ADD KEGIATAN, ]
    // HAPUS KEGIATAN, HAPUS USER
    try {
        query = "INSERT INTO `users_activity`( `username`, `last_activity`, `Keterangan` ) VALUES ('" + username + "','" + activity + "','" + information + "')"
        db.query(query, (err,results) => {
            if (err) throw err;

        });
    } catch (error) {
        return "ERROR";
    }
}

function set_login(username) {
    
    try {
        query = "UPDATE `users` SET `status` = '1' WHERE `users`.`username` = '" + username +"'; ";
        db.query(query, (err,results) => {
            if (err) throw err;

        });
        users_log_activiy(username, "LOG_IN")
    } catch (error) {
        return "Gagal tersambung";
    }
}

function validate_obj(obj){

    if (obj["Desa"] === "-" || obj["Desa"] === null){
        return false;
    }
    if (obj["Kecamatan"] === "-" || obj["Kecamatan"] === null){
        return false;
    }
    if (obj["Pengawas"] === "-" || obj["Pengawas"] === null){
        return false;
    }
    if (obj["Pencacah"] === "-" || obj["Pencacah"] === null){
        return false;
    }
    if (obj["NBS"] === "-" || obj["NBS"] === null){
        return false;
    }
    if (obj["NKS"] === "-" || obj["Pencacah"] === null){
        return false;
    }
    return true;
}

function set_logout(username) {
    try {
        // Destroy Session
        query = "UPDATE `users` SET `status` = '0' WHERE `users`.`username` = '" + username +"'; ";
        db.query(query, (err,results) => {
            if (err) throw err;

        });
        users_log_activiy(username,"LOG_OUT");
    } catch (error) {
        
    }
}

function nothing_in_db(id_kegiatan, callback) {   
    query = "SELECT * FROM `dokumen` WHERE id_kegiatan = '" + id_kegiatan + "' LIMIT 10 ;";
    let hasil = false;
    db.query(query, (err, results) => {
        if (err) {
            callback(err, null);
            return;
        }
        if (results.length === 0) {
            hasil = true;
        }
        callback(null, hasil);
    });
}

// Mendapatkan seluruh kode sls,desa dan kecamatan
function get_kode_daerah(callback) {
    try {
        query = "SELECT sls.kode AS 'SLS', desa.kode AS 'Desa', kecamatan.kode AS 'Kec' FROM `sls` INNER JOIN desa ON sls.kode_desa = desa.kode AND sls.kode_kec = desa.kode_kec INNER JOIN kecamatan on desa.kode_kec = kecamatan.kode";
        db.query(query, (err,results) => {
            if (err) {
                callback(err, null);
                return;
            }
            callback(null, results);
        })
    } catch (error) {
        throw error;
    }
}

// Fungsi untuk mendapatkan seluruh kecamatan untuk kegiatan Survei
function get_kec_survei(id_kegiatan, callback) {
    const query = 'SELECT dokumen.kode_sls AS "kode_sls", kecamatan.nama as "nama_kec", dokumen.x AS "id_x", dokumen.kode_desa AS "kode_desa", dokumen.kode_kec AS "kode_kec",survei.status_pengdok, survei.status_edcod, survei.status_entri FROM `survei` INNER JOIN dokumen ON survei.id_dok = dokumen.id_dok AND survei.id_kegiatan = dokumen.id_kegiatan INNER JOIN kecamatan ON kecamatan.kode = dokumen.kode_kec WHERE survei.id_kegiatan = ?;';
    // console.log(query);
    // Jalankan query dengan parameterized query untuk menghindari SQL Injection
    db.query(query, [id_kegiatan], (err, results) => {
        if (err) {
            callback(err, null);
            return;
        }
        callback(null, results);
    });
}

// Fungsi untuk mendapatkan seluruh kecamatan untuk kegiatan Sensus
function get_kec_sensus(id_kegiatan, callback) {
    const query = 'SELECT dokumen.kode_sls AS "kode_sls", dokumen.x AS "id_x", dokumen.kode_desa AS "kode_desa", dokumen.kode_kec AS "kode_kec", kecamatan.nama AS "nama_kec" , sensus.status_pengdok, sensus.status_edcod, sensus.status_entri FROM `sensus` INNER JOIN dokumen ON sensus.id_dok = dokumen.id_dok AND sensus.id_kegiatan = dokumen.id_kegiatan INNER JOIN kecamatan ON dokumen.kode_kec = kecamatan.kode WHERE sensus.id_kegiatan = ? ORDER BY dokumen.kode_kec ASC;';
    // console.log(query);
    // Jalankan query dengan parameterized query untuk menghindari SQL Injection
    db.query(query, [id_kegiatan], (err, results) => {
        if (err) {
            callback(err, null);
            return;
        }
        // console.log(results);
        callback(null, results);
    });
}


// Autentikasi User (Admin) di cek menggunakan fungsi ini
function authenticateToken(req, res, next) {
    const token = req.headers['token']
    if (token == null) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, secretKey, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.user = user;
        if (user.role === 'Admin'){
            next();
        }else{
            res.sendStatus(403); // Forbidden
        }
    });
}

// Autentikasi User (Admin) di cek menggunakan fungsi ini
function authenticateTokenLevel2(req, res, next) {
    const token = req.headers['token']
    if (token == null) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, secretKey, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.user = user;
        if (user.role == 'Admin' || user.role == 'Pengawas'){
            next();
        }else{
            res.sendStatus(403); // Forbidden
        }
    });
}

// mendapatkan informasi user dari token menggunakan fungsi ini
function get_users_info(req, res, next) {
    const token = req.headers['token']
    
    if (token == null) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, secretKey, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.user = user;
        // console.log(req.user);
        next();
    });
}

//END OF FUNCTION//////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////
// GET 
////////////////////////////////////////////////////////////////////

app.get("/", (req,res) => {
    res.send("Yaa kenapa?");
});


// Endpoint untuk mengakses file
app.get('/files/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'file', filename);
  
    // Baca file dari sistem file
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error('Error reading file:', err);
        return res.status(500).send('Internal Server Error');
      }
  
      // Kirim file sebagai respons
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(data);
    });
  });

//END OF GET//////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////
// POST
////////////////////////////////////////////////////////////////////

// API untuk mendapatkan tgl progres
app.post('/progres_bar/:id_kegiatan', async (req,res) => {
    const jenis = req.params.jenis;
    const id = req.params.id_kegiatan;

    info(id , (err,results) => {
        if (err) {
            res.sendStatus(500);
        }

        const data = results;
        const jenis = data[0].jenis

        let the_q = ""
        if (jenis === "2"){
            the_q = "survei"
        }else{
            the_q = "sensus"
        }

        const query = `
        SELECT 
            'tgl_pengdok' AS jenis_data,
            YEAR(tgl_pengdok) AS tahun,
            MONTH(tgl_pengdok) AS bulan,
            CASE
                WHEN DAYOFMONTH(tgl_pengdok) <= 7 THEN '1'
                WHEN DAYOFMONTH(tgl_pengdok) <= 14 THEN '2'
                WHEN DAYOFMONTH(tgl_pengdok) <= 21 THEN '3'
                ELSE '4'
            END AS minggu,
            COUNT(*) AS frekuensi
        FROM 
            ${the_q}
        WHERE 
            tgl_pengdok IS NOT NULL AND id_kegiatan = ?
        GROUP BY 
            jenis_data, tahun, bulan, minggu

        UNION ALL

        SELECT 
            'tgl_edcod' AS jenis_data,
            YEAR(tgl_edcod) AS tahun,
            MONTH(tgl_edcod) AS bulan,
            CASE
                WHEN DAYOFMONTH(tgl_edcod) <= 7 THEN '1'
                WHEN DAYOFMONTH(tgl_edcod) <= 14 THEN '2'
                WHEN DAYOFMONTH(tgl_edcod) <= 21 THEN '3'
                ELSE '4'
            END AS minggu,
            COUNT(*) AS frekuensi
        FROM 
            ${the_q}
        WHERE 
            tgl_edcod IS NOT NULL AND id_kegiatan = ?
        GROUP BY 
            jenis_data, tahun, bulan, minggu


        UNION ALL

        SELECT 
            'tgl_entri' AS jenis_data,
            YEAR(tgl_entri) AS tahun,
            MONTH(tgl_entri) AS bulan,
            CASE
                WHEN DAYOFMONTH(tgl_entri) <= 7 THEN '1'
                WHEN DAYOFMONTH(tgl_entri) <= 14 THEN '2'
                WHEN DAYOFMONTH(tgl_entri) <= 21 THEN '3'
                ELSE '4'
            END AS minggu,
            COUNT(*) AS frekuensi
        FROM 
            ${the_q}
        WHERE 
            tgl_entri IS NOT NULL AND id_kegiatan = ?
        GROUP BY 
            jenis_data, tahun, bulan, minggu;
        `;
        db.query(query, [id,id,id], (err, results) => {

            if (err){
                res.status(400).send({msg:err});
            }
            res.status(200).send(results);
        });
    })
})

// API untuk menerima file upload dari frontend
app.post('/upload', upload.single('file'), async (req, res) => {
    // const username = req.user.username
    const file = req.file;
    const id = req.body.id_kegiatan
    if (!file) {
        return res.status(400).send('No file uploaded');
    }

    // Validasi ekstensi file
    const allowedExtensions = ['.xlsx'];
    const fileExtension = path.extname(file.originalname);
    if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).send({
            msg : "File"
        });
    }
    
    // Baca file Excel yang diunggah
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Konversi data Excel menjadi JSON
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    // Lakukan sesuatu dengan data JSON, misalnya kirimkan kembali sebagai respons atau simpan ke database
    // console.log('Data from Excel:', jsonData[0]);
    // console.log("id_kegiatan", id);

    let query_dokumen = "INSERT INTO `dokumen`(`id_kegiatan`, `id_dok`, `kode_sls`, `x`, `kode_desa`, `kode_kec`, `ppl`, `pml`, `koseka`, `jenis`) VALUES "
    let query_survei = "INSERT INTO `survei`(`id_kegiatan`, `id_dok`, `no_blok_sensus`, `no_kerangka_sampel`, `no_ruta`, `KRT`) VALUES "

    let id_dok = 1

    // console.log(jsonData);

    let isWrongFormat = false;
    for (let i = 0; i<jsonData.length; i++){
        const obj = jsonData[i];
        if(!validate_obj(obj)){
            isWrongFormat = true;
        }
    }

    for (let i = 0; i < jsonData.length; i++) {
        const obj = jsonData[i];
        
        query_dokumen += "('" + id + "','" + id_dok + "','" + obj["SLS"] + "','" + obj["Korong"] +"','" + obj["Desa"] + "','" + obj["Kecamatan"] + "','" + obj["Pencacah"] + "','" + obj["Pengawas"] + "','" + "-" + "', '" + "2" + "'),"

        // Loop through each key-value pair in the object
        for (const key in obj) {
           
            // console.log(id_dok);
            
            if (key.includes("Ruta")){
                const value = obj[key];
                const str = key
                const startIndex = str.indexOf(' ') + 1;
                const ruta = str.slice(startIndex); 
                
                query_survei += "('" + id + "','" + id_dok + "','" + obj["NBS"] + "','" + obj["NKS"] + "','" + ruta + "','" + value + "'),"
               
            }
        }

        id_dok += 1;
    }

    query_dokumen = query_dokumen.slice(0,-1)
    query_dokumen += ";"
    query_survei = query_survei.slice(0,-1)
    query_survei += ";"

    
    if (isWrongFormat){
        res.status(400).json({ 
            msg : "Failed"
        });
    }else{
        db.query(query_dokumen, (err,resulsts) => {
            if (err){
                console.log("error di query dokumen");
                res.status(400).send({
                    msg : "Unknown Error",
                    data : err
                })
            }
        })

        db.query(query_survei, (err,resulsts) => {
            if (err){
                console.log("error di query survei");
                res.status(400).send({
                    msg : "Unknown Error",
                    data : err
            })
            }
        })

        // Tanggapi dengan hasil pemrosesan
        change_stats(id,3)
        // LOG ACTIVITY
        // users_log_activiy(username,"UPLOAD_SAMPEL",id)
        res.status(200).json({ 
            msg : "Success",
        });
    }
});

// API untuk mendapatkan activity dari user
app.post("/get_user_activity/:username", async (req,res) => {
    const usr = req.params.username;
    check_username(usr)
    .then(l => {
        if (l != 0){
            const query = "SELECT * FROM `users_activity` WHERE username = ? ORDER BY time DESC;";
            db.query(query, [usr], (err,results) => {
                if (err){
                    res.status(400).send({
                        msg: "Failed",
                    })
                }else{
                    res.status(200).send(results);
                }
            })
            
        }else{
            res.status(400).send({
                msg: "No User",
            })
        }
    })
})


// API Check Username sudah ada atau belum di database
app.post("/check_username/:usrnm", async (req,res) =>{
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
    // console.log(req.user);
    try{
        const { username, password, firstName, lastName, gender, role, status } = req.body;
        const hashedPass = await bcrypt.hash(password, 10);

        const usrname = req.user.username

        let isRB = null
        if(role === 'Admin'){
            isRB = 1;
        }

        //Push ke db
        const query = "INSERT INTO `users` (`username`, `firstName`, `lastName`, `pass`, `gender` , `role`, `isRB` , `status`, `created_at`) VALUES ('" + username + "', '" + firstName + "', '" + lastName + "', '" + hashedPass +"', '" + gender +"' ,'" + role + "', '" + isRB + "','" + status + "', current_timestamp());"
        check_username(username)
        .then(l => {
            if(l != 0){
                res.status(200).send({
                    "msg" : "Username Duplikat"
                })
            }else{
                db.query(query, (err,results) => {
                    if (err){
                        throw err;
                        res.status(403).send(err);
                    }
                    
                    // SetActivity
                    users_log_activiy(usrname,"ADD_USER",username)

                    res.status(201).send({
                        "msg" : "Berhasil"
                    });
                });
            }
        });
        
    } catch(error){
        // res.status(500).send("Terjadi Kesalahan")
    }
    
})

// API untuk assign petugas
app.post("/assign_petugas/:id_kegiatan", async (req, res) => {
    const id = req.params.id_kegiatan;
    try {
        const data = req.body;
        let query = '';

        const promises = [];

        for (let i = 1; i <= Object.keys(data[0]).length; i++) {
            const k = "UPDATE `dokumen` SET `ppl` = '" + data[0][i.toString()] + "', `pml` = '" + data[1][i.toString()] + "', `koseka` = '" + data[2][i.toString()] + "' WHERE `dokumen`.`id_kegiatan` = '" + id + "' AND `dokumen`.`id_dok` = '" + i + "' ";
            promises.push(new Promise((resolve, reject) => {
                db.query(k, (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            }));
        }

        await Promise.all(promises);
        change_stats(id,3)
        res.status(200).send({
            msg: "Assign Petugas Berhasil"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({
            error: "Terjadi Kesalahan"
        });
    }
});


// API Login
app.post("/login", async (req,res) => {

    try {

        const { username, password } = req.body;
        
        const query = "SELECT username,firstName,lastName,gender,role,pass FROM `users` WHERE `username`= ?;";
        console.log(query);
        db.query(query, [username] ,(err,results) =>{
            if (results.length === 0){
                // Jika Kesalahan berada pada username
                res.status(400).send({
                    msg : "Username",
                    accessToken : "-",
                });
            }else{
                let hashed_pass = results[0].pass;
                bcrypt.compare(password, hashed_pass, function(err,resultss){
                    if (err) {
                        // Kesalahan selama pembandingan
                        res.status(500).send("Terjadi Kesalahan")
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
                            
                            set_login(info.username);
                            res.status(200).json({
                                msg:"Success",
                                accessToken : token,
                                role : results[0].role,
                                username : info.username,
                                fullName : info.firstName + " " + info.lastName
                            })
                           
                            
                        } else {
                            // Jika Kesalahan berada pada password
                            res.status(400).send({msg:"Password", accessToken : "-"});
                        }
                    }
                });
            }
        });
    } catch (error) {
        res.status(500).send("Terjadi Kesalahan")
    }
});

// API untuk update Role
app.post("/update_role_users", authenticateToken, async (req,res) => {

    const new_role = req.body.role;
    const username = req.body.username;
    const usrnm = req.user.username;
    try{
        const query = "UPDATE `users` SET `role`='" + new_role +"' WHERE username = ?;"
        db.query(query, [username], (err,results) => {
            if (err){
                res.status(400).send({msg:"Unknown Error"});
            }
            else{
                // Set Activity
                users_log_activiy(usrnm, "ROLE_MANAGEMENT",`${username} -> ${new_role}`)
                res.status(200).send({msg: "Success"});
            }
        })
    }catch(error){
        res.status(500).send("Terjadi Kesalahan")
    }
})

// API untuk update Password
app.post("/update_password_users", async (req,res) => {
    
    try {

        const { username, password, newPass } = req.body;
        
        const newHashedPass = await bcrypt.hash(newPass, 10);

        // check apakah terdapat kesalahan username
        const query = 'SELECT username,firstName,lastName,gender,role,pass FROM `users` WHERE `username`= "' + username + '";';
        db.query(query, (err,results) =>{
            if (!results.length){
                // Jika Kesalahan berada pada username
                res.status(400).send({
                    msg : "Username",
                    accessToken : "-",
                });
            }else{
                let hashed_pass = results[0].pass;
                bcrypt.compare(password, hashed_pass, function(err,resultss){
                    if (err) {
                        // Kesalahan selama pembandingan
                        console.error('Error during password comparison:', err);
                    } else {
                        // Hasil pembandingan
                        if (resultss) {
                            // Update Password disini
                            
                            console.log(newHashedPass);
                            const query_update = "UPDATE `users` SET `pass`='" + newHashedPass + "' WHERE username = ?;"
                            console.log(query_update);
                            db.query(query_update, [username], (err,results) => {
                                if (err){
                                    res.status(500).send({msg:err})
                                }else{
                                    users_log_activiy(username, "CHANGE_PASSWORD");
                                    res.status(200).send({msg:"Success"})
                                }
                            })
                        } else {
                            // Jika Kesalahan berada pada password
                            res.status(400).send({msg:"Password Salah", accessToken : "-"});
                        }
                    }
                });
            }
        });
    } catch (error) {
        res.status(500).send("Terjadi Kesalahan")
    }
});

// API Log Out
app.post("/logout", get_users_info ,async (req,res) => {
    try {
        const info = req.user;
        const username = info.username;
        set_logout(username);
        res.status(200).send({
            msg: "Success"
        })
    } catch (error) {
        res.status(200).send({
            msg: error
        })
    }
});

// API untuk mendapatkan informasi dari suatu user
app.post("/get_users_info/:username", authenticateToken ,async (req,res) => {
    try {
        const username = req.params.username;
        check_username(username)
        .then(l => {
            if (l != 0){
                const query = "SELECT username,firstName,lastName,role,gender,status FROM `users` WHERE username = ? ;";
                db.query(query, [username], (err,results) => {
                    if (err){
                        res.status(400).send({
                            msg: "Failed",
                        })
                    }else{
                        res.status(200).send(results);
                    }
                })
            }else{
                res.status(400).send({
                    msg: "No User",
                })
            }
        })
    } catch (error) {
        res.status(200).send({
            msg: error
        })
    }
});

// API Register Kegiatan Baru
app.post("/add_kegiatan", authenticateToken, async (req,res) => {

    // Autentikasi User dulu, apakah bisa menambahkan kegiatan baru atau tidak

    try{
        const info = req.user
        const username = info.username

        
        const { id, nama, jenis, tgl_mulai, target_selesai, koseka, target_pengdok, target_edcod, target_entri } = req.body;
        

        let status = '1'
        if (jenis === '1'){
            status = '3'
        }

        nothing_in_db(id, (err,hasil) => {
            if (err){
                console.error("Terjadi kesalahan:", err);
                return;
            }

            if (hasil) {
                //Push ke db
                query = "INSERT INTO `kegiatan` (`id`, `nama`, `jenis`, `metode`, `initiator_id`, `status`,`tanggal_mulai`, `target_selesai`, `koseka`, `target_pengdok`, `target_edcod`, `target_entri`, `created_at`) VALUES ('" + id +"', '" + nama +"', '" + jenis +"', '2', '" + req.user.username +"', '" + status +"', '" + tgl_mulai + "', '" + target_selesai + "', '" + koseka + "', '" + target_pengdok + "', '" + target_edcod + "', '" + target_entri + "', current_timestamp());"
                db.query(query, (err,results) => {
                    if (err) throw err;
                });

                // SetActivity
                users_log_activiy(username,"ADD_KEGIATAN",id)

                res.status(201).send({
                    msg: "Berhasil",
                });
            }else{
                res.status(400).send({
                    type : "duplicate_id",
                    msg: "ID telah digunakan",
                });
            }
        })
    } catch(error){
        res.status(500).send({
            type : "Unknown_error", 
            msg: "Register Gagal sini",
        })
    }
});


app.post("/update_kegiatan", authenticateToken, async (req,res) => {

    try {
        const { id, tanggal_mulai, target_selesai, target_pengdok, target_edcod, target_entri } = req.body;
        const username = req.user.username;
        query = "UPDATE `kegiatan` SET `tanggal_mulai` = '" + tanggal_mulai +"', `target_selesai` = '" + target_selesai + "', `target_pengdok` = '" + target_pengdok + "', `target_edcod` = '" + target_edcod + "', `target_entri` = '" + target_entri +"' WHERE `kegiatan`.`id` = '" + id + "';";
        db.query(query, (err,results) => {
            if (err){
                res.status(400).send({
                    msg: "Unknown Error"
                });
            }else{
                // LOG ACTIVITY
                users_log_activiy(username,"UPDATE_KEGIATAN")
                res.status(200).send({
                    msg: "Success"
                });
            }
        })
    } catch (error) {
        
    }
});

app.post("/delete_user/:usrnm", authenticateToken, async (req,res) =>{

    try {
        const usrnm = req.params.usrnm;
        const username = req.user.username
        query = "DELETE FROM `users` WHERE username = '" + usrnm + "';";
        db.query(query , (err,results) =>{
            if(err){
                res.status(500).send({msg : "Internal Server Error"})
            }else{
                const second_query = "DELETE FROM `users_activity` WHERE 'username = ?;"
                db.query(second_query , (err2, results2) => {
                    if(err2){
                        res.status(500).send({msg : "Internal Server Error"});
                    }else{
                        // Log Activity Users
                        users_log_activiy(username, "DELETE_USERS",usrnm)
                        res.status(200).send({
                            msg : "Success"
                        });   
                    }
                });
            }
        });
    } catch (error) {
        res.sendStatus(500);
    }
});

app.post("/delete_kegiatan/:id_kegiatan", authenticateToken, (req,res) => {

    const id = req.params.id_kegiatan
    const username = req.user.username

    query = "DELETE FROM `kegiatan` WHERE id = '" + id + "';";
    info(id , (err,results) => {
        if (err) {
            
            res.sendStatus(500);
        }

        const data = results;
        const jenis = data[0].jenis

        let the_q = ""
        if (jenis === "2"){
            the_q = "DELETE FROM `survei` WHERE id_kegiatan = '" + id +"';"
        }else{
            the_q = "DELETE FROM `sensus` WHERE id_kegiatan = '" + id +"';"
        }
        
        db.query(the_q, (err,res) => {
            if (err) throw err;
        })

        const q = "DELETE FROM `dokumen` WHERE id_kegiatan = '" + id +"';"
        
        db.query(q, (err,res) => {
            if (err) throw err;
        })

        const query = "DELETE FROM `kegiatan` WHERE id = '" + id +"'; "
        
        db.query(query, (err,ress) => {
            if (err) throw err;
        })

        // SetActivity
        users_log_activiy(username,"DELETE_KEGIATAN",id)

        res.status(200).send("Hapus kegiatan " + id + " Berhasil"); 
    })
});

// mengambil semua list kegiatan
app.post("/get_all_kegiatan", async (req,res) => {
    query = "SELECT nama,id,tanggal_mulai,jenis,status,metode,initiator_id,progres FROM `kegiatan`;";
    db.query(query, (err,results) => {
        if (err) throw err;
            res.status(200).send(results);
    })
})

// mendapatkan semua anggota ipds
app.post("/get_all_admin", async (req,res) => {
    query = "SELECT username,lastName,firstName FROM `users` WHERE isRB = '1';";
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    })
})

// mendapatkan semua mitra edcod
app.post("/get_all_mitra_edcod", async (req,res) => {
    query = "SELECT * FROM `mitra`WHERE status = 'Edcod' AND CURDATE() BETWEEN DATE(start_contract) AND DATE(end_contract);";
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    })
})

// mendapatkan semua mitra entri
app.post("/get_all_mitra_entri", async (req,res) => {
    query = "SELECT * FROM `mitra`WHERE status = 'Entri' AND CURDATE() BETWEEN DATE(start_contract) AND DATE(end_contract);";
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    })
})

// mendapatkan semua mitra
app.post("/get_all_mitra", async (req,res) => {
    query = "SELECT id,nama, status, DATE_FORMAT(start_contract, '%Y-%m-%d') AS start_contract, DATE_FORMAT(end_contract, '%Y-%m-%d') AS end_contract FROM mitra ORDER BY status;";
    db.query(query, (err,results) => {
        if (err) throw err;
        const data_json = JSON.stringify(results)
        const modified_data = JSON.parse(data_json)

        const newData = modified_data.map((item) => {
            item.start_contract = item.start_contract.slice(0,10);
            item.end_contract = item.end_contract.slice(0,10);

            return item;
        });

        res.status(200).send(newData);
    })
})

// menginput mitra baru
app.post("/register_mitra", authenticateToken, async (req,res) => {
    try {
        query = "INSERT INTO `mitra` (`id`, `nama`, `status`, `start_contract`, `end_contract`) VALUES (NULL, ?, ?, ?, ?);"
        const data = req.body;
        const nama = data.nama;
        const status = data.tugas
        const start_contract = data.start
        const end_contract = data.end
        const username = req.user.username

        db.query(query, [nama,status,start_contract,end_contract] , (err,results) => {
            if (err) throw err;
            // Log Activity Users
            users_log_activiy(username, "ADD_MITRA",nama)
            res.status(200).send({
                msg: "Berhasil",
            })   
        })
    } catch (error) {
        res.status(500).send({
            msg: "Internal Server Error",
        })   
    }
})

// Edit Mitra
app.post("/edit_mitra", authenticateToken, async (req,res) => {
    try {
        q = "UPDATE `mitra` SET `nama` = ?, `status` = ?, `start_contract` = ?, `end_contract` = ? WHERE `mitra`.`id` = ? "
        const data = req.body;
        const nama = data.nama;
        const status = data.tugas
        const start_contract = data.start
        const end_contract = data.end
        const id = data.id
        const username = req.user.username

        db.query(q, [nama,status,start_contract,end_contract,id] , (err,results) => {
            if (err) throw err;
            // Log Activity Users
            users_log_activiy(username, "EDIT_MITRA",nama)
            res.status(200).send({
                msg: "Berhasil",
            })   
        })
    } catch (error) {
        res.status(500).send({
            msg: "Internal Server Error",
        })   
    }
})

// mengambil info mengenai suatu kegiatan
app.post("/get_info/:id", async (req,res) => {
    
    const id = req.params.id;
    query = "SELECT * FROM `kegiatan` WHERE id = '" + id + "';";
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    })
})

// API untuk mengisi tabel dokumen dan surve, parameter : id_kegiatan (id kegiatan survei)
app.post("/fill_survei/:id_kegiatan", authenticateToken, async (req,res) => {
    
    id_kegiatan = req.params.id_kegiatan;
    
    try {

        const data = req.body

        nothing_in_db(id_kegiatan, (err, hasil) => {
            if (err) {
                console.error("Terjadi kesalahan:", err);
                return;
            }

            if (hasil){
                get_kode_daerah((err, results) => {
                    if (err) {
                        console.log("Terjadi kesalahan:", err);
                        return;
                    }
                    const kode_daerah = results
                    // generate query
                    the_query = "INSERT INTO `dokumen`(`id_kegiatan`, `id_dok`, `kode_sls`, `x`, `kode_desa`, `kode_kec`, `ppl`, `pml`, `koseka`, `jenis`) VALUES "
                    the_query_2 = "INSERT INTO `survei`(`id_kegiatan`, `id_dok`, `no_blok_sensus`, `no_kerangka_sampel`, `no_ruta`, `KRT`) VALUES "
                    
                    // id_dok start from 1
                    let id_dok = 1

                    for (let key in data){

                        the_query += "('" + id_kegiatan + "', '" + id_dok + "', '000100','"+ key +"', '"+ data[key]["kode_desa"] +"', '" + data[key]["kode_kec"] +"', '-', '-', '-', '2'),"

                        let no_ruta = 1
                        for (let the_key in data[key]["krt"]){
                            // console.log("Ruta ", the_key , " : ", data[key]["krt"][the_key]);
                            the_query_2 += "('"+ id_kegiatan +"', '" + id_dok + "', '" + data[key]["noBS"] +"', '"+ data[key]["noKS"] + "', '" + no_ruta + "', '" + data[key]["krt"][the_key] +"'),"
                            no_ruta += 1
                        }
                        id_dok += 1
                    }

                    the_query = the_query.slice(0,-1)
                    the_query_2 = the_query_2.slice(0,-1)

                    the_query += ";";
                    the_query_2 += ";";

                    // console.log(the_query);
                    // console.log(the_query_2);
                    db.query(the_query, (err, results) =>{
                        if (err) throw err;
                    })
                    db.query(the_query_2, (err, results) =>{
                        if (err) throw err;
                    })
                    change_stats(id_kegiatan,"3");
                    res.status(200).send("Berhasil");
                });
            }else{
                // jika kegiatan sudah ada di dalam tabel dokumen
                res.status(400).send("Kegiatan sudah ada");
            }
        });

    } catch (error) {
        
    }
})

// API untuk mendapatkan progres per kecamatan
app.post("/get_progres_kecamatan/:id", async (req,res) => {
    try {
        const id = req.params.id
        info(id, (err,results) => {
            if (err) {
                res.sendStatus(500);
            }

            const data = results
            const jenis = data[0].jenis
            // Survei
            if (jenis === "2"){
                const id_kegiatan = id
                get_kec_survei(id_kegiatan, (err, results) => {
                    if (err) {
                        console.log("Terjadi kesalahan");
                        res.sendStatus(500);
                        return;
                    }
                    
                    const data = results;
                    // console.log(results);
                    let data_progres = {}; // inisialisasi objek kosong
            
                    // Iterasi melalui data dan mengisi objek data_progres
                    data.forEach(item => {
                        if (!data_progres[item.kode_kec]) {
                            data_progres[item.kode_kec] = {
                                nama_kec : "",
                                rb: 0,
                                edcod: 0,
                                entri: 0,
                                total: 0,
                                progres_rb : 0,
                                progres_edcod : 0,
                                progres_entri : 0,
                            };
                        }
            
                        data_progres[item.kode_kec]["nama_kec"] = item["nama_kec"]
            
                        if (item.status_pengdok === 1) {
                            data_progres[item.kode_kec]["rb"] += 1;
                        }
                        if (item.status_edcod === 1) {
                            data_progres[item.kode_kec]["edcod"] += 1;
                        }
                        if (item.status_entri === 1) {
                            data_progres[item.kode_kec]["entri"] += 1;
                        }
                        data_progres[item.kode_kec]["total"] += 1;
                        data_progres[item.kode_kec]["progres_rb"] = (data_progres[item.kode_kec]["rb"]/data_progres[item.kode_kec]["total"]) * 100;
                        data_progres[item.kode_kec]["progres_edcod"] = (data_progres[item.kode_kec]["edcod"]/data_progres[item.kode_kec]["total"]) * 100;
                        data_progres[item.kode_kec]["progres_entri"] = (data_progres[item.kode_kec]["entri"]/data_progres[item.kode_kec]["total"]) * 100;
                
                    });
            
                    // console.log(data_progres);
                    res.status(200).send(data_progres);
                });
            }
            // Sensus
            else{
                const id_kegiatan = id
                get_kec_sensus(id_kegiatan, (err,results) => {
                    if (err) {
                        res.sendStatus(500);
                        return;
                    }
                    const data = results;
                    let data_progres = {}; // inisialisasi objek kosong
            
                    // Iterasi melalui data dan mengisi objek data_progres
                    data.forEach(item => {
                        if (!data_progres[item.kode_kec]) {
                            data_progres[item.kode_kec] = {
                                nama_kec : "",
                                rb: 0,
                                edcod: 0,
                                entri: 0,
                                total: 0,
                                progres_rb : 0,
                                progres_edcod : 0,
                                progres_entri : 0,
                            };
                        }
            
                        data_progres[item.kode_kec]["nama_kec"] = item["nama_kec"]
            
                        if (item.status_pengdok === 1) {
                            data_progres[item.kode_kec]["rb"] += 1;
                        }
                        if (item.status_edcod === 1) {
                            data_progres[item.kode_kec]["edcod"] += 1;
                        }
                        if (item.status_entri === 1) {
                            data_progres[item.kode_kec]["entri"] += 1;
                        }
                        data_progres[item.kode_kec]["total"] += 1;
                        data_progres[item.kode_kec]["progres_rb"] = (data_progres[item.kode_kec]["rb"]/data_progres[item.kode_kec]["total"]) * 100;
                        data_progres[item.kode_kec]["progres_edcod"] = (data_progres[item.kode_kec]["edcod"]/data_progres[item.kode_kec]["total"]) * 100;
                        data_progres[item.kode_kec]["progres_entri"] = (data_progres[item.kode_kec]["entri"]/data_progres[item.kode_kec]["total"]) * 100;
                
                    });
            
                    res.status(200).send(data_progres);
                });
            }
        })
    } catch (error) {
        
    }
})

// API untuk mendapatkan progres per kecamatan
app.post("/get_progres_kecamatan_sensus/:id", async (req,res) => {
    id_kegiatan = req.params.id;
    get_kec_sensus(id_kegiatan, (err,results) => {
        if (err) {
            // console.log("Terjadi kesalahan");
            res.sendStatus(500);
            return;
        }
        const data = results;
        // console.log(results);
        let data_progres = {}; // inisialisasi objek kosong

        // Iterasi melalui data dan mengisi objek data_progres
        data.forEach(item => {
            if (!data_progres[item.kode_kec]) {
                data_progres[item.kode_kec] = {
                    nama_kec : "",
                    rb: 0,
                    edcod: 0,
                    entri: 0,
                    total: 0,
                    progres_rb : 0,
                    progres_edcod : 0,
                    progres_entri : 0,
                };
            }

            data_progres[item.kode_kec]["nama_kec"] = item["nama_kec"]

            if (item.status_pengdok === 1) {
                data_progres[item.kode_kec]["rb"] += 1;
            }
            if (item.status_edcod === 1) {
                data_progres[item.kode_kec]["edcod"] += 1;
            }
            if (item.status_entri === 1) {
                data_progres[item.kode_kec]["entri"] += 1;
            }
            data_progres[item.kode_kec]["total"] += 1;
            data_progres[item.kode_kec]["progres_rb"] = (data_progres[item.kode_kec]["rb"]/data_progres[item.kode_kec]["total"]) * 100;
            data_progres[item.kode_kec]["progres_edcod"] = (data_progres[item.kode_kec]["edcod"]/data_progres[item.kode_kec]["total"]) * 100;
            data_progres[item.kode_kec]["progres_entri"] = (data_progres[item.kode_kec]["entri"]/data_progres[item.kode_kec]["total"]) * 100;
    
        });


        // console.log(data_progres);
        res.status(200).send(data_progres);
    });
});

// API untuk mendapatkan progres per kecamatan (survei)
app.post("/get_progres_kecamatan_survei/:id", async (req, res) => {
    id_kegiatan = req.params.id
    get_kec_survei(id_kegiatan, (err, results) => {
        if (err) {
            console.log("Terjadi kesalahan");
            res.sendStatus(500);
            return;
        }
        
        const data = results;
        // console.log(results);
        let data_progres = {}; // inisialisasi objek kosong

        // Iterasi melalui data dan mengisi objek data_progres
        data.forEach(item => {
            if (!data_progres[item.kode_kec]) {
                data_progres[item.kode_kec] = {
                    nama_kec : "",
                    rb: 0,
                    edcod: 0,
                    entri: 0,
                    total: 0,
                    progres_rb : 0,
                    progres_edcod : 0,
                    progres_entri : 0,
                };
            }

            data_progres[item.kode_kec]["nama_kec"] = item["nama_kec"]

            if (item.status_pengdok === 1) {
                data_progres[item.kode_kec]["rb"] += 1;
            }
            if (item.status_edcod === 1) {
                data_progres[item.kode_kec]["edcod"] += 1;
            }
            if (item.status_entri === 1) {
                data_progres[item.kode_kec]["entri"] += 1;
            }
            data_progres[item.kode_kec]["total"] += 1;
            data_progres[item.kode_kec]["progres_rb"] = (data_progres[item.kode_kec]["rb"]/data_progres[item.kode_kec]["total"]) * 100;
            data_progres[item.kode_kec]["progres_edcod"] = (data_progres[item.kode_kec]["edcod"]/data_progres[item.kode_kec]["total"]) * 100;
            data_progres[item.kode_kec]["progres_entri"] = (data_progres[item.kode_kec]["entri"]/data_progres[item.kode_kec]["total"]) * 100;
    
        });

        // console.log(data_progres);
        res.status(200).send(data_progres);
    });
});

// API untuk mendapatkan progres petugas RB (sensus)
app.post("/get_progres_pengdok_sensus/:id_kegiatan", async (req,res) => {
    id = req.params.id_kegiatan;
    try {
        const query  ="SELECT users.firstName, users.lastName , COUNT(penerima_dok) as 'TOTAL' FROM sensus INNER JOIN users ON users.username = sensus.penerima_dok WHERE id_kegiatan = ? GROUP BY penerima_dok;"
        db.query(query, [id], (err,results) => {
            if (err) throw err;
            res.status(200).send(results)
        })
    } catch (error) {
        res.status(500)
    }
})

// API untuk mendapatkan progres petugas RB (Survei)
app.post("/get_progres_pengdok_survei/:id_kegiatan", async (req,res) => {
    id = req.params.id_kegiatan;
    try {
        const query  ="SELECT users.firstName, users.lastName , COUNT(penerima_dok) as 'TOTAL' FROM survei INNER JOIN users ON users.username = survei.penerima_dok WHERE id_kegiatan = ? GROUP BY penerima_dok;"
        db.query(query, [id], (err,results) => {
            if (err) throw err;
            res.status(200).send(results)
        })
    } catch (error) {
        console.error(error);
    }
})

// API untuk mendapatkan progres petugas Edcod (Survei)
app.post("/get_progres_edcod_survei/:id_kegiatan", async (req,res) => {
    id = req.params.id_kegiatan;
    try {
        const query  ="SELECT mitra.nama, COUNT(petugas_edcod) as 'TOTAL' FROM survei INNER JOIN mitra ON mitra.id = survei.petugas_edcod WHERE id_kegiatan = ? GROUP BY petugas_edcod;"
        db.query(query, [id], (err,results) => {
            if (err) throw err;
            res.status(200).send(results)
        })
    } catch (error) {
        console.error(error);
    }
})

// API untuk mendapatkan progres petugas Edcod (sensus)
app.post("/get_progres_edcod_sensus/:id_kegiatan", async (req,res) => {
    id = req.params.id_kegiatan;
    try {
        const query  ="SELECT mitra.nama, COUNT(petugas_edcod) as 'TOTAL' FROM sensus INNER JOIN mitra ON mitra.id = sensus.petugas_edcod WHERE id_kegiatan = ? GROUP BY petugas_edcod;"
        db.query(query, [id], (err,results) => {
            if (err) throw err;
            res.status(200).send(results)
        })
    } catch (error) {
        console.error(error);
    }
})


// API untuk mendapatkan progres petugas Entri (Survei)
app.post("/get_progres_entri_survei/:id_kegiatan", async (req,res) => {
    id = req.params.id_kegiatan;
    try {
        const query  ="SELECT mitra.nama, COUNT(petugas_entri) as 'TOTAL' FROM survei INNER JOIN mitra ON mitra.id = survei.petugas_entri WHERE id_kegiatan = ? GROUP BY petugas_entri;"
        db.query(query, [id], (err,results) => {
            if (err) throw err;
            res.status(200).send(results)
        })
    } catch (error) {
        console.error(error);
    }
})

// API untuk mendapatkan progres petugas Entri (sensus)
app.post("/get_progres_entri_sensus/:id_kegiatan", async (req,res) => {
    id = req.params.id_kegiatan;
    try {
        const query  ="SELECT mitra.nama, COUNT(petugas_entri) as 'TOTAL' FROM sensus INNER JOIN mitra ON mitra.id = sensus.petugas_entri WHERE id_kegiatan = ? GROUP BY petugas_entri;"
        db.query(query, [id], (err,results) => {
            if (err) throw err;
            res.status(200).send(results)
        })
    } catch (error) {
        console.error(error);
    }
})

// API untuk mendapatkan progres keseluruhan RB, Edcod dan Entri
app.post("/get_overall_progres/:id_kegiatan", async (req,res) => {
    try {
        const id = req.params.id_kegiatan;
        info(id, (err,results) => {
            if (err) {
                res.sendStatus(500);
            }

            const data = results
            const jenis = data[0].jenis

            if (jenis === "2"){
                const query = "SELECT (SELECT COUNT(*) FROM survei WHERE id_kegiatan = ? AND status_pengdok = '1') AS rb,(SELECT COUNT(*) FROM survei WHERE id_kegiatan = ? AND status_edcod = '1') AS edcod,(SELECT COUNT(*) FROM survei WHERE id_kegiatan = ? AND status_entri = '1') AS entri,(SELECT COUNT(*) FROM survei WHERE id_kegiatan = ?) AS total,(SELECT MIN(tgl_pengdok) AS mulai_pengdok FROM survei WHERE id_kegiatan = ?) AS start_pengdok, (SELECT MIN(tgl_edcod) AS mulai_pengdok FROM survei WHERE id_kegiatan = ?) AS start_edcod, (SELECT MIN(tgl_entri) AS mulai_pengdok FROM survei WHERE id_kegiatan = ?) AS start_entri;"
                db.query(query, [id,id,id,id,id,id,id], (err,results) => {
                    if(err){
                        throw err;
                    }
                    res.status(200).send(results);
                })
            }else{
                const query = "SELECT (SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '" + id +"' AND status_pengdok = '1') AS rb,(SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '" + id +"' AND status_edcod = '1') AS edcod,(SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '" + id +"' AND status_entri = '1') AS entri,(SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '" + id +"') AS total,(SELECT MIN(tgl_pengdok) AS mulai_pengdok FROM sensus WHERE id_kegiatan = '" + id +"') AS start_pengdok,(SELECT MIN(tgl_edcod) AS tgl_pengdok FROM sensus WHERE id_kegiatan = '" + id +"') AS start_edcod,(SELECT MIN(tgl_entri) AS tgl_entri FROM sensus WHERE id_kegiatan = '" + id +"') AS start_entri;"
                db.query(query, [id,id,id,id], (err,results) => {
                    if(err){
                        throw err;
                    }
                    res.status(200).send(results);
                    });
            }
        })
    } catch (error) {
        throw error;
    }
});


// API untuk mendapatkan ONLY_PROGRES (%) keseluruhan menjadi satu
app.post("/get_only_progres/:id_kegiatan", (req,res) => {
    id = req.params.id_kegiatan
    try {
        info(id, (err,results) => {
            if (err) {
            
                res.sendStatus(500);
            }else{
                const data = results;
                const jenis = data[0].jenis
                let q = ""
                if (jenis === "2"){
                    // Query Survei
                    q = `SELECT (SELECT COUNT(*) FROM survei WHERE id_kegiatan = '${id}' AND status_pengdok = '1') AS rb,
                    (SELECT COUNT(*) FROM survei WHERE id_kegiatan = '${id}' AND status_edcod = '1') AS edcod,
                    (SELECT COUNT(*) FROM survei WHERE id_kegiatan = '${id}' AND status_entri = '1') AS entri,
                    (SELECT COUNT(*) FROM survei WHERE id_kegiatan = '${id}') AS total;`
                }else{
                    // Query Sensus
                    q = `SELECT (SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '${id}' AND status_pengdok = '1') AS rb,
                    (SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '${id}' AND status_edcod = '1') AS edcod,
                    (SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '${id}' AND status_entri = '1') AS entri,
                    (SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '${id}') AS total;`
                }
                console.log(q);
                db.query(q, (err,ress) => {
                    if (err) {
                        console.error("Query Error: ", err);
                        return res.sendStatus(500).send({ 'msg': 'Database query error' });
                    }
                    if (ress.length === 0) {
                        return res.status(404).send({ 'msg': 'No data found' });
                    }
        
                    const sum = ress[0].rb + ress[0].edcod + ress[0].entri;
                    const total = ress[0].total * 3;
                    const persentase = ((sum / total) * 100).toFixed(2);
        
                    console.log("id: ", id, sum, total, persentase);
                    if (sum === 0) {
                        res.status(200).send({
                            'msg': "Success",
                            'persentase': "-"
                        });
                    } else {
                        res.status(200).send({
                            'msg': "Success",
                            'persentase': persentase
                        });
                    }
                })
            }
        })
    }
    catch (error){

    }
})

// API untuk mendapatkan progres keseluruhan RB, Edcod, dan Entri
app.post("/get_progres_sensus/:id_kegiatan", async (req,res) => {
    id = req.params.id_kegiatan
    try {
        const query = "SELECT (SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '" + id +"' AND status_pengdok = '1') AS rb,(SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '" + id +"' AND status_edcod = '1') AS edcod,(SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '" + id +"' AND status_entri = '1') AS entri,(SELECT COUNT(*) FROM sensus WHERE id_kegiatan = '" + id +"') AS total,(SELECT MIN(tgl_pengdok) AS mulai_pengdok FROM sensus WHERE id_kegiatan = '" + id +"') AS start_pengdok,(SELECT MIN(tgl_edcod) AS tgl_pengdok FROM sensus WHERE id_kegiatan = '" + id +"') AS start_edcod,(SELECT MIN(tgl_entri) AS tgl_entri FROM sensus WHERE id_kegiatan = '" + id +"') AS start_entri;";
        db.query(query, [id,id,id,id], (err,results) => {
            if(err){
                res.status(200).send(err);
            }else{
                res.status(200).send(results);
            }
        })
    } catch (error) {
        console.log(error);
    }
})

// API untuk mendapatkan progres keseluruhan RB, Edcod, dan Entri
app.post("/get_progres_survei/:id_kegiatan", async (req,res) => {
    id = req.params.id_kegiatan
    try {
        const query = "SELECT (SELECT COUNT(*) FROM survei WHERE id_kegiatan = ? AND status_pengdok = '1') AS rb,(SELECT COUNT(*) FROM survei WHERE id_kegiatan = ? AND status_edcod = '1') AS edcod,(SELECT COUNT(*) FROM survei WHERE id_kegiatan = ? AND status_entri = '1') AS entri,(SELECT COUNT(*) FROM survei WHERE id_kegiatan = ?) AS total,(SELECT MIN(tgl_pengdok) AS mulai_pengdok FROM survei WHERE id_kegiatan = ?) AS start_pengdok, (SELECT MIN(tgl_edcod) AS mulai_pengdok FROM survei WHERE id_kegiatan = ?) AS start_edcod, (SELECT MIN(tgl_entri) AS mulai_pengdok FROM survei WHERE id_kegiatan = ?) AS start_entri;";
        db.query(query, [id,id,id,id,id,id,id], (err,results) => {
            if(err){
                throw err;
            }
            res.status(200).send(results);
        })
    } catch (error) {
        console.log(error);
    }
})

// API untuk mendapatkan semua users (digunakan untuk assign petugas)
app.post("/get_all_users", authenticateToken, async (req,res) => {
    try {
        const query = "SELECT `username`, `firstName`, `lastName`, `role`, `status` FROM `users` ORDER BY `role`,`status` DESC;"
        db.query(query, (err,results) => {
            if (err) throw err;
            // console.log(results);
            res.status(200).send(results);
        })
    } catch (error) {
        console.log(error);
    }
})

// API untuk mengisi tabel dokumen dan sensus, parameter : id_kegiatan (id kegiatan sensus)
app.post("/fill_sensus/:id_kegiatan", authenticateToken , async (req,res) => {
    
    id_kegiatan = req.params.id_kegiatan;
    try {
        nothing_in_db(id_kegiatan, (err, hasil) => {
            if (err) {
                console.error("Terjadi kesalahan:", err);
                return;
            }

            if (hasil){
                get_kode_daerah((err, results) => {
                    if (err) {
                        console.log("Terjadi kesalahan:", err);
                        return;
                    }
                    const kode_daerah = results;
                    // generate query
                    the_query = "INSERT INTO `dokumen`(`id_kegiatan`, `id_dok`, `kode_sls`, `kode_desa`, `kode_kec`, `ppl`, `pml`, `koseka`, `jenis`) VALUES "
                    the_query_2 = "INSERT INTO `sensus`(`id_kegiatan`, `id_dok`) VALUES "
                    // id_dok start from 1
        
                    kode_daerah.forEach((item,index) => {
                        p = index + 1
                        if (p != kode_daerah.length){
                            q = "('" + id_kegiatan +"','" + p +"','" + item.SLS + "','" + item.Desa + "','" + item.Kec + "','-','-','-','1'),";
                            q_2 = "('" + id_kegiatan + "','" + p +"'),"
                            the_query += q;
                            the_query_2 += q_2;
                        }else{
                            q = "('" + id_kegiatan +"','" + p +"','" + item.SLS + "','" + item.Desa + "','" + item.Kec + "','-','-','-','1')";
                            q_2 = "('" + id_kegiatan + "','" + p +"')"
                            the_query += q;
                            the_query_2 += q_2;
                        }
                        
                    });
                    the_query += ";";
                    the_query_2 += ";";
                    db.query(the_query, (err, results) =>{
                        if (err) throw err;
                    })
                    db.query(the_query_2, (err, results) =>{
                        if (err) throw err;
                    })
                    res.status(200).send("Berhasil");
                });
            }else{
                // jika kegiatan sudah ada di dalam tabel dokumen
                res.status(400).send("Kegiatan sudah ada");
            }
        });

    } catch (error) {
        
    }
})

// API untuk mengecek id_kegiatan unik
app.post("/check_id_kegiatan/:id_kegiatan", authenticateToken, async (req,res) => {
    id = req.params.id_kegiatan
    query = "SELECT * FROM `kegiatan` WHERE id = '" + id + "';";
    db.query(query, (err,results) => {
        if (err) throw err;
        // console.log(results);
        const l = results.length
        // console.log(l);
        if (l === 0){
            res.status(200).send({
                msg: "Sukses",
                bisa : true
            })
        }else{
            // console.log("else");
            res.status(200).send({
                msg: "Gagal",
                bisa : false
            })
        }
    })
})

// API untuk mendapatkan kode wilayah, dan status pengolahan sensus, parameter : id_kegiatan (id kegiatan sensus)
app.post("/get_pengolahan_data/:id_kegiatan", async (req,res) => {
    id_kegiatan = req.params.id_kegiatan
    query = "SELECT dokumen.id_dok, dokumen.kode_kec, kecamatan.nama AS 'Kec', dokumen.kode_desa, desa.nama AS 'Desa' ,dokumen.kode_sls, sls.nama_x AS 'SLS', dokumen.ppl, dokumen.pml, dokumen.koseka, sensus.total_dokumen, sensus.tgl_pengdok, sensus.penerima_dok, sensus.status_pengdok, sensus.status_edcod, sensus.petugas_edcod, sensus.tgl_edcod, sensus.status_entri, sensus.petugas_entri, sensus.moda_entri, sensus.tgl_entri FROM `dokumen` INNER JOIN sensus on dokumen.id_kegiatan = sensus.id_kegiatan AND dokumen.id_dok = sensus.id_dok INNER JOIN kecamatan on kecamatan.kode = dokumen.kode_kec INNER JOIN desa on desa.kode = dokumen.kode_desa AND dokumen.kode_kec = desa.kode_kec INNER JOIN sls on sls.kode = dokumen.kode_sls AND sls.kode_desa = dokumen.kode_desa AND sls.kode_kec = dokumen.kode_kec WHERE dokumen.id_kegiatan = '" + id_kegiatan + "' AND sensus.id_kegiatan = '" + id_kegiatan + "' ORDER BY dokumen.kode_kec, dokumen.kode_desa, dokumen.kode_sls ASC;"
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    });
})


// API untuk mendapatkan kode wilayah, dan status pengolahan sensus, parameter : id_kegiatan (id kegiatan survei)
app.post("/get_pengolahan_data_survei/:id_kegiatan", async (req,res) => {
    id_kegiatan = req.params.id_kegiatan
    query = "SELECT dokumen.id_dok, dokumen.kode_kec, kecamatan.nama AS 'Kec', dokumen.kode_desa, desa.nama AS 'Desa' , dokumen.x AS 'nama_x', survei.no_blok_sensus, survei.KRT, survei.no_kerangka_sampel , survei.no_ruta AS 'no_ruta', dokumen.ppl, dokumen.pml, dokumen.koseka, survei.tgl_pengdok, survei.penerima_dok, survei.status_pengdok, survei.status_edcod, survei.petugas_edcod, survei.tgl_edcod, survei.status_entri, survei.petugas_entri, survei.moda_entri, survei.tgl_entri FROM dokumen INNER JOIN kecamatan on kecamatan.kode = dokumen.kode_kec INNER JOIN desa on desa.kode = dokumen.kode_desa AND dokumen.kode_kec = desa.kode_kec INNER JOIN survei on dokumen.id_kegiatan = survei.id_kegiatan AND dokumen.id_dok = survei.id_dok WHERE dokumen.id_kegiatan = '" + id_kegiatan + "' AND survei.id_kegiatan = '" + id_kegiatan + "';"
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    });
})

// API untuk mendapatkan seluruh Korong (Digunakan untuk memilih sampel dari seluruh SLS yang ada)
app.post("/get_sls", async (req,res) => {
    query = "SELECT x.nama AS 'Korong', desa.kode AS 'kode_desa', desa.nama AS 'Desa', kecamatan.kode AS 'kode_kec', kecamatan.nama AS 'Kec' FROM `x` INNER JOIN desa ON x.kode_desa = desa.kode AND x.kode_kec = desa.kode_kec INNER JOIN kecamatan on x.kode_kec = kecamatan.kode ORDER BY kode_kec, kode_desa;"
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    })
})

// Clone dari get_sls
app.post("/get_sls2", async (req,res) => {
    query = "SELECT sls.kode AS 'kode_sls', sls.nama_x AS 'SLS', desa.kode AS 'kode_desa', desa.nama AS 'Desa', kecamatan.kode AS 'kode_kec', kecamatan.nama AS 'Kec' FROM `sls` INNER JOIN desa ON sls.kode_desa = desa.kode AND sls.kode_kec = desa.kode_kec INNER JOIN kecamatan on sls.kode_kec = kecamatan.kode ORDER BY kecamatan.kode, desa.kode, sls.kode ASC ;"
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    })
})

// API untuk mengubah isian tabel survei kolom RB
app.post("/update_RB_survei", authenticateTokenLevel2, async (req,res) => {
    const {id_kegiatan, no_blok_sensus, no_kerangka_sampel, no_ruta, tgl_pengdok, penerima_dok, status_pengdok } = req.body;
    const username = req.user.username
    let query = ''
    if (tgl_pengdok !== null){
        query = "UPDATE `survei` SET `status_pengdok` = '" + status_pengdok +"', `tgl_pengdok` = '" + tgl_pengdok +"', `penerima_dok` = '" + penerima_dok +"' WHERE `survei`.`id_kegiatan` = '" + id_kegiatan +"' AND `survei`.`no_blok_sensus` = '" + no_blok_sensus +"' AND `survei`.`no_kerangka_sampel` = '" + no_kerangka_sampel +"' AND `survei`.`no_ruta` = '" + no_ruta +"';"
    }else{
        query = "UPDATE `survei` SET `status_pengdok` = NULL, `tgl_pengdok` = NULL , `penerima_dok` = NULL WHERE `survei`.`id_kegiatan` = '" + id_kegiatan +"' AND `survei`.`no_blok_sensus` = '" + no_blok_sensus +"' AND `survei`.`no_kerangka_sampel` = '" + no_kerangka_sampel +"' AND `survei`.`no_ruta` = '" + no_ruta +"';"
    }
    // console.log(query);
    db.query(query, (err,results) => {
        if (err) throw err;
        // LOG ACTIVITY
        users_log_activiy(username,"UPDATE_RB",`id:${id_kegiatan} nbs:${no_blok_sensus} nks:${no_kerangka_sampel} ruta:${no_ruta} status:${status_pengdok}`)
        update_progres(id_kegiatan);
        res.status(200).send({
            msg : "Update Berhasil"
        });
    })
})

// API untuk mengubah isian tabel survei kolom Edcod
app.post("/update_Edcod_survei", authenticateTokenLevel2, async (req,res) => {
    const {id_kegiatan, no_blok_sensus, no_kerangka_sampel, no_ruta, tgl_edcod, petugas_edcod, status_edcod } = req.body;
    const username = req.user.username
    // console.log(id_kegiatan, no_blok_sensus, no_kerangka_sampel, no_ruta, tgl_edcod, petugas_edcod, status_edcod);
    let query = ''
    if (tgl_edcod !== null){
        query = "UPDATE `survei` SET `status_edcod` = '" + status_edcod +"', `tgl_edcod` = '" + tgl_edcod +"', `petugas_edcod` = '" + petugas_edcod +"' WHERE `survei`.`id_kegiatan` = '" + id_kegiatan +"' AND `survei`.`no_blok_sensus` = '" + no_blok_sensus +"' AND `survei`.`no_kerangka_sampel` = '" + no_kerangka_sampel +"' AND `survei`.`no_ruta` = '" + no_ruta +"';"
    }else{
        query = "UPDATE `survei` SET `status_edcod` = NULL, `tgl_edcod` = NULL , `petugas_edcod` = NULL WHERE `survei`.`id_kegiatan` = '" + id_kegiatan +"' AND `survei`.`no_blok_sensus` = '" + no_blok_sensus +"' AND `survei`.`no_kerangka_sampel` = '" + no_kerangka_sampel +"' AND `survei`.`no_ruta` = '" + no_ruta +"';"
    }
    // console.log(query);
    db.query(query, (err,results) => {
        if (err) throw err;
        // LOG ACTIVITY
        users_log_activiy(username,"UPDATE_EDCOD",`id:${id_kegiatan} nbs:${no_blok_sensus} nks:${no_kerangka_sampel} ruta:${no_ruta} status:${status_edcod}`);
        update_progres(id_kegiatan);
        res.status(200).send({
            msg : "Update Berhasil"
        });
    })
})

// API untuk mengubah isian tabel survei kolom Entri
app.post("/update_Entri_survei", authenticateTokenLevel2, async (req,res) => {
    const username = req.user.username
    const {id_kegiatan, no_blok_sensus, no_kerangka_sampel, no_ruta, tgl_entri, petugas_entri, status_entri } = req.body;
    // console.log(id_kegiatan, no_blok_sensus, no_kerangka_sampel, no_ruta, tgl_entri, petugas_entri, status_entri);
    let query = ''
    if (tgl_entri !== null){
        query = "UPDATE `survei` SET `status_entri` = '" + status_entri +"', `tgl_entri` = '" + tgl_entri +"', `petugas_entri` = '" + petugas_entri +"' WHERE `survei`.`id_kegiatan` = '" + id_kegiatan +"' AND `survei`.`no_blok_sensus` = '" + no_blok_sensus +"' AND `survei`.`no_kerangka_sampel` = '" + no_kerangka_sampel +"' AND `survei`.`no_ruta` = '" + no_ruta +"';"
    }else{
        query = "UPDATE `survei` SET `status_entri` = NULL, `tgl_entri` = NULL , `petugas_entri` = NULL WHERE `survei`.`id_kegiatan` = '" + id_kegiatan +"' AND `survei`.`no_blok_sensus` = '" + no_blok_sensus +"' AND `survei`.`no_kerangka_sampel` = '" + no_kerangka_sampel +"' AND `survei`.`no_ruta` = '" + no_ruta +"';"
    }
    // console.log(query);
    db.query(query, (err,results) => {
        if (err) throw err;
        // LOG ACTIVITY
        users_log_activiy(username,"UPDATE_ENTRI",`id:${id_kegiatan} nbs:${no_blok_sensus} nks:${no_kerangka_sampel} ruta:${no_ruta} status:${status_entri}`)
        update_progres(id_kegiatan);
        check_is_finish(id_kegiatan, (err,isFinish) => {
            if (err) {
                console.error(err);
            } else {
                if(isFinish){
                    change_stats(id_kegiatan,"4");
                }
            }
        }); 
        res.status(200).send({
            msg : "Update Berhasil"
        });
    })
})

// API untuk mengubah isian tabel sensus kolom RB
app.post("/update_RB",authenticateTokenLevel2, async (req,res) => {
    const username = req.user.username;
    const { id_kegiatan, id_dok, status_pengdok , tgl_pengdok, penerima_dok } = req.body;
    // console.log(req.body);
    let query = ''
    if (tgl_pengdok === null){
        query += "UPDATE `sensus` SET `status_pengdok` = NULL, `tgl_pengdok` = NULL, `penerima_dok` = NULL WHERE `sensus`.`id_kegiatan` = '" + id_kegiatan + "' AND `sensus`.`id_dok` = '" + id_dok + "';";
    }else{
        query += "UPDATE `sensus` SET `status_pengdok` = '" + status_pengdok + "', `tgl_pengdok` = '" + tgl_pengdok + "', `penerima_dok` = '" + penerima_dok + "' WHERE `sensus`.`id_kegiatan` = '" + id_kegiatan + "' AND `sensus`.`id_dok` = '" + id_dok + "';";
    }
    // 

    db.query(query, (err,results) => {
        if (err) throw err;
        // LOG ACTIVITY
        users_log_activiy(username,"UPDATE_RB",`id:${id_kegiatan} status:${status_pengdok}`)
        update_progres(id_kegiatan);
        res.status(200).send({
            msg: "Update Berhasil"
        });
    })
    // console.log(id_kegiatan,status_pengdok,tgl_pengdok,penerima_dok,id_dok);
})

// API untuk mengubah isian tabel sensus kolom Edcod
app.post("/update_Edcod", authenticateTokenLevel2, async (req,res) => {

    const username = req.user.username;
    const { id_kegiatan, id_dok, status_edcod , tgl_edcod, petugas_edcod } = req.body;
    // console.log(req.body);

    let query = ""

    if (tgl_edcod === null){
        query += "UPDATE `sensus` SET `status_edcod` = NULL, `tgl_edcod` = NULL, `petugas_edcod` = NULL WHERE `sensus`.`id_kegiatan` = '" + id_kegiatan + "' AND `sensus`.`id_dok` = '" + id_dok + "'";
    }else{
        query += "UPDATE `sensus` SET `status_edcod` = '" + status_edcod + "', `tgl_edcod` = '" + tgl_edcod + "', `petugas_edcod` = '" + petugas_edcod + "' WHERE `sensus`.`id_kegiatan` = '" + id_kegiatan + "' AND `sensus`.`id_dok` = '" + id_dok + "'";
    }

    // console.log(query);

    db.query(query, (err,results) => {
        if (err) throw err;
        // LOG ACTIVITY
        users_log_activiy(username,"UPDATE_EDCOD",`id:${id_kegiatan} status:${status_edcod}`)
        update_progres(id_kegiatan, "edcod");
        res.status(200).send({
            msg: "Update Berhasil"
        });
    });
    // console.log(id_kegiatan,id_dok, status_edcod, tgl_edcod, petugas_edcod);
})

// API untuk mengubah isian tabel sensus kolom Entri
app.post("/update_Entri", authenticateTokenLevel2, async (req,res) => {
    const username = req.user.username;
    const { id_kegiatan, id_dok, status_entri , tgl_entri, petugas_entri, moda } = req.body;
    // console.log(req.body);
    let query = ''
    if (tgl_entri === null){
        query = "UPDATE `sensus` SET `status_entri` = NULL, `tgl_entri` = NULL, `petugas_entri` = NULL, `moda_entri` = NULL WHERE `sensus`.`id_kegiatan` = '" + id_kegiatan + "' AND `sensus`.`id_dok` = '" + id_dok + "';";
    }else{
        query = "UPDATE `sensus` SET `status_entri` = '" + status_entri + "', `tgl_entri` = '" + tgl_entri + "', `petugas_entri` = '" + petugas_entri + "', `moda_entri` = '" + moda +"' WHERE `sensus`.`id_kegiatan` = '" + id_kegiatan + "' AND `sensus`.`id_dok` = '" + id_dok + "';";
    }

    // console.log(query);
    // console.log(id_kegiatan,status_entri,tgl_entri,petugas_entri,id_dok);

    db.query(query, (err,results) => {
        if (err) throw err;
        // LOG ACTIVITY
        users_log_activiy(username,"UPDATE_ENTRI",`id:${id_kegiatan} status:${status_entri}`)
        update_progres(id_kegiatan);
        check_is_finish(id_kegiatan, (err,isFinish) => {
            if (err) {
                console.error(err);
            } else {
                if(isFinish){
                    change_stats(id_kegiatan,"4");
                }
            }
        }); 
        res.status(200).send({
            msg: "Update Berhasil"
        });
    })
   
})


// API untuk test fungsi (DEVELOPMENT)
app.post("/test", (req,res) => {

})


//END OF POST//////////////////////////////////////////////////
write_log(`Program berjalan di http://localhost:${port}, time : ${currentTime}`);
console.clear()
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
