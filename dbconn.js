const mysql = require('mysql');

var con = mysql.createConnection({
    host : "localhost",
    user: "root",
    password: "",
    database: "skrips"
});

con.connect(function(err){
    if (err){
        console.log("MySQL Error");
    }else{
        console.log("MySQL Connected");
    }
});

module.exports = con;