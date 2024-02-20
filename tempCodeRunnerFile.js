db.query(query, (err,results) => {
        if (err) throw err;
        res.status(200).send("Update Berhasil");
    })