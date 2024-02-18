const mysql = require('mysql');

var con = mysql.createConnection({
    host : "localhost",
    user: "root",
    password: "",
    database: "skrips"
});

con.connect(function(err){
    if (err) throw err;
    console.log("MySQL Connected");
});

module.exports = con;