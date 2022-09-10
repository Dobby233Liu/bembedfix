import { renderFile } from "ejs";

module.exports = function (req, res) {
    renderFile("../template.html")
    .catch(function (err) {
        err.errno = 500;
        err.message = "Error ocurred while rendering embed";
        console.error(err);
        res.status(500).json(err);
    })
    .then(data => res.send(data));
};
