query = "INSERT INTO `kegiatan` (`id`, `nama`, `jenis`, `metode`, `initiator_id`, `status`, `taget_selesai`, `koseka`, `target_pengdok`, `target_edcod`, `target_entri`, `created_at`) VALUES ('" + id +"', '" + nama +"', '" + jenis +"', '2', '" + initiator_id +"', '1', '" + target_selesai + "', '" + koseka + "', '" + target_pengdok + "', '" + target_edcod + "', '" + target_entri + "', current_timestamp());"
        // db.query(query, (err,results) => {
        //     if (err) throw err;
        // });