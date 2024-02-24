const express = require('express');
var db = require('./dbconn');
var write_log = require('./writeLog');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = 3001;
const secretKey = 'secretKey';
const salt = 10

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
                console.log("Total username ada di database : " + l);
                console.log("l : " + l);
                resolve(l);
            }
        });
    }); 
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

            // BUAT SESSION DISINI

            // Masukan kedalam Log
        });
        users_log_activiy(username, "LOG_IN")
    } catch (error) {
        return "Gagal tersambung";
    }
}

function set_logout(username) {
    try {
        // Destroy Session
        users_log_activiy(username,"LOG_OUT");
    } catch (error) {
        
    }
}

// fungsi untuk mengecek apakah id kegiatan sudah ada di tabel database
// Penggunaan : 
// nothing_in_db(id_kegiatan, (err, hasil) => {
//     if (err) {
//         console.error("Terjadi kesalahan:", err);
//         return;
//     }

//     if (hasil){
//     
//      * JIKA KEGIATAN TIDAK ADA DI DATABASE, MAKA LAKUKAN SESUATU DISINI
//  
//      }
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
        console.log(error);
    }
}

// Autentikasi User (Admin) di cek menggunakan fungsi ini
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
                            set_login(info.username);
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

// API Log Out
app.post("/logout",(req,res) => {
    try {
        const info = req.user;
        const username = info.username;
        set_logout(username);
    } catch (error) {
        return "ERROR";
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

// mendapatkan semua anggota ipds
app.post("/get_all_admin", (req,res) => {
    query = "SELECT username,lastName,firstName FROM `users` WHERE role = 'admin';";
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    })
})

// mendapatkan semua mitra edcod
app.post("/get_all_mitra_edcod", (req,res) => {
    query = "SELECT * FROM `mitra` WHERE status = 'Editing';";
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    })
})

// mendapatkan semua mitra edcod
app.post("/get_all_mitra_entri", (req,res) => {
    query = "SELECT * FROM `mitra` WHERE status = 'Entri';";
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

app.post("/get_info/:id", (req,res) => {
    const id = req.params.id;
    query = "SELECT * FROM `kegiatan` WHERE id = '" + id + "';";
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    })
})

// API untuk mengisi tabel dokumen dan surve, parameter : id_kegiatan (id kegiatan survei)
app.post("/fill_survei/:id_kegiatan",(req,res) => {
    
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
                    the_query = "INSERT INTO `dokumen`(`id_kegiatan`, `id_dok`, `kode_sls`, `id_x`, `kode_desa`, `kode_kec`, `id_ppl`, `id_pml`, `id_koseka`, `jenis`) VALUES "
                    the_query_2 = "INSERT INTO `survei`(`id_kegiatan`, `id_dok`, `no_blok_sensus`, `no_kerangka_sampel`, `no_ruta`, `KRT`) VALUES "
                    
                    // id_dok start from 1
                    let id_dok = 1

                    for (let key in data){
                        // console.log("Key : ", key);
                        // console.log("kode_desa : ", data[key]["kode_desa"]);
                        // console.log("kode_kec : ", data[key]["kode_kec"]);
                        // console.log("noKS : ", data[key]["noKS"]);
                        // console.log("noBS : ", data[key]["noBS"]);
                        // console.log("jumlah ruta : ", data[key]["jumlah_ruta"])

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

                    console.log(the_query);
                    console.log(the_query_2);
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


// API untuk mengisi tabel dokumen dan sensus, parameter : id_kegiatan (id kegiatan sensus)
app.post("/fill_sensus/:id_kegiatan",(req,res) => {
    
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
                    const kode_daerah = results
                    // generate query
                    the_query = "INSERT INTO `dokumen`(`id_kegiatan`, `id_dok`, `kode_sls`, `kode_desa`, `kode_kec`, `id_ppl`, `id_pml`, `id_koseka`, `jenis`) VALUES "
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

// API untuk mendapatkan kode wilayah, dan status pengolahan sensus, parameter : id_kegiatan (id kegiatan sensus)
app.post("/get_pengolahan_data/:id_kegiatan", (req,res) => {
    id_kegiatan = req.params.id_kegiatan
    query = "SELECT dokumen.id_dok, dokumen.kode_kec, kecamatan.nama AS 'Kec', dokumen.kode_desa, desa.nama AS 'Desa' ,dokumen.kode_sls, sls.nama_x AS 'SLS', dokumen.id_ppl, dokumen.id_pml, dokumen.id_koseka, sensus.total_dokumen, sensus.tgl_pengdok, sensus.penerima_dok, sensus.status_pengdok, sensus.status_edcod, sensus.petugas_edcod, sensus.tgl_edcod, sensus.status_entri, sensus.petugas_entri, sensus.moda_entri, sensus.tgl_entri FROM `dokumen` INNER JOIN sensus on dokumen.id_kegiatan = sensus.id_kegiatan AND dokumen.id_dok = sensus.id_dok INNER JOIN kecamatan on kecamatan.kode = dokumen.kode_kec INNER JOIN desa on desa.kode = dokumen.kode_desa AND dokumen.kode_kec = desa.kode_kec INNER JOIN sls on sls.kode = dokumen.kode_sls AND sls.kode_desa = dokumen.kode_desa AND sls.kode_kec = dokumen.kode_kec WHERE dokumen.id_kegiatan = '" + id_kegiatan + "' AND sensus.id_kegiatan = '" + id_kegiatan + "' ORDER BY dokumen.kode_kec, dokumen.kode_desa, dokumen.kode_sls ASC;"
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    });
})


// API untuk mendapatkan kode wilayah, dan status pengolahan sensus, parameter : id_kegiatan (id kegiatan survei)
app.post("/get_pengolahan_data_survei/:id_kegiatan", (req,res) => {
    id_kegiatan = req.params.id_kegiatan
    query = "SELECT dokumen.id_dok, dokumen.kode_kec, kecamatan.nama AS 'Kec', dokumen.kode_desa, desa.nama AS 'Desa' , dokumen.id_x AS 'id_x' , x.nama AS 'nama_x', survei.no_blok_sensus, survei.KRT, survei.no_kerangka_sampel , survei.no_ruta AS 'no_ruta', dokumen.id_ppl, dokumen.id_pml, dokumen.id_koseka, survei.tgl_pengdok, survei.penerima_dok, survei.status_pengdok, survei.status_edcod, survei.petugas_edcod, survei.tgl_edcod, survei.status_entri, survei.petugas_entri, survei.moda_entri, survei.tgl_entri FROM dokumen INNER JOIN kecamatan on kecamatan.kode = dokumen.kode_kec INNER JOIN desa on desa.kode = dokumen.kode_desa AND dokumen.kode_kec = desa.kode_kec INNER JOIN x on x.id = dokumen.id_x AND x.kode_desa = dokumen.kode_desa AND x.kode_kec = dokumen.kode_kec INNER JOIN survei on dokumen.id_kegiatan = survei.id_kegiatan AND dokumen.id_dok = survei.id_dok WHERE dokumen.id_kegiatan = '" + id_kegiatan + "' AND survei.id_kegiatan = '" + id_kegiatan + "';"
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    });
})

// API untuk mendapatkan seluruh Korong (Digunakan untuk memilih sampel dari seluruh SLS yang ada)
app.post("/get_sls",(req,res) => {
    query = "SELECT x.id AS 'id', x.nama AS 'Korong', desa.kode AS 'kode_desa', desa.nama AS 'Desa', kecamatan.kode AS 'kode_kec', kecamatan.nama AS 'Kec' FROM `x` INNER JOIN desa ON x.kode_desa = desa.kode AND x.kode_kec = desa.kode_kec INNER JOIN kecamatan on x.kode_kec = kecamatan.kode ORDER BY kode_kec, kode_desa;"
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send(results);
    })
})

// API untuk mengubah isian tabel sensus kolom RB
app.post("/update_RB", (req,res) => {
    const { id_kegiatan, id_dok, status_pengdok , tgl_pengdok, penerima_dok } = req.body;
    console.log(req.body);
    let query = ''
    if (penerima_dok === undefined){
        query = "UPDATE `sensus` SET `status_pengdok` = '" + status_pengdok + "', `tgl_pengdok` = '" + tgl_pengdok + "' WHERE `sensus`.`id_kegiatan` = '" + id_kegiatan + "' AND `sensus`.`id_dok` = '" + id_dok + "';";
    }else{
        query = "UPDATE `sensus` SET `status_pengdok` = '" + status_pengdok + "', `tgl_pengdok` = '" + tgl_pengdok + "', `penerima_dok` = '" + penerima_dok + "' WHERE `sensus`.`id_kegiatan` = '" + id_kegiatan + "' AND `sensus`.`id_dok` = '" + id_dok + "';";
    }
    
    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send("Update Berhasil");
    })
    console.log(id_kegiatan,status_pengdok,tgl_pengdok,penerima_dok,id_dok);
})

// API untuk mengubah isian tabel sensus kolom Edcod
app.post("/update_Edcod", (req,res) => {
    const { id_kegiatan, id_dok, status_edcod , tgl_edcod, petugas_edcod } = req.body;
    console.log(req.body);

    if (petugas_edcod === undefined){
        query = "UPDATE `sensus` SET `status_edcod` = '" + status_edcod + "', `tgl_edcod` = '" + tgl_edcod + "' WHERE `sensus`.`id_kegiatan` = '" + id_kegiatan + "' AND `sensus`.`id_dok` = '" + id_dok + "'";
    }else{
        query = "UPDATE `sensus` SET `status_edcod` = '" + status_edcod + "', `tgl_edcod` = '" + tgl_edcod + "', `petugas_edcod` = '" + petugas_edcod + "' WHERE `sensus`.`id_kegiatan` = '" + id_kegiatan + "' AND `sensus`.`id_dok` = '" + id_dok + "'";
    }

    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send("Update Berhasil");
    })
    console.log(id_kegiatan,id_dok, status_edcod, tgl_edcod, petugas_edcod);
})

// API untuk mengubah isian tabel sensus kolom Entri
app.post("/update_Entri", (req,res) => {
    const { id_kegiatan, id_dok, status_entri , tgl_entri, petugas_entri } = req.body;
    console.log(req.body);
    let query = ''
    if (petugas_entri === undefined){
        query = "UPDATE `sensus` SET `status_entri` = '" + status_entri + "', `tgl_entri` = '" + tgl_entri + "' WHERE `sensus`.`id_kegiatan` = '" + id_kegiatan + "' AND `sensus`.`id_dok` = '" + id_dok + "';";
    }else{
        query = "UPDATE `sensus` SET `status_entri` = '" + status_entri + "', `tgl_entri` = '" + tgl_entri + "', `petugas_entri` = '" + petugas_entri + "' WHERE `sensus`.`id_kegiatan` = '" + id_kegiatan + "' AND `sensus`.`id_dok` = '" + id_dok + "';";
    }

    console.log(query);
    console.log(id_kegiatan,status_entri,tgl_entri,petugas_entri,id_dok);

    db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send("Update Berhasil");
    })
   
})


// API untuk test fungsi (DEVELOPMENT)
app.post("/test", (req,res) => {

    
})


//END OF POST//////////////////////////////////////////////////
write_log(`Program berjalan di http://localhost:${port}, time : ${currentTime}`);
app.listen(port, () => console.log(`Program berjalan di http://localhost:${port}, time : ${currentTime}`));
