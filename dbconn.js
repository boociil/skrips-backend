const mysql = require('mysql');

var con = mysql.createConnection({
    host : "localhost",
    user: "root",
    password: "",
    database: 'for_test_kueri'
});

con.connect(function(err){
    if (err) throw err;
    console.log("MySQL Connected");
});

module.exports = con;