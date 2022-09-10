import { renderFile } from "ejs";

module.exports = function (req, res) {
    renderFile("../template.html")
    .catch(function (err) {
        console.error(err);
        res.status(500).send(err);
    })
    .then(data => res.send(data));
};
