import { render, renderFile } from "ejs";
import { join } from "path";
import { ERROR_TEMPLATE } from "./conf.js";

export function generateError(code, message, data, req) {
    let outData = data.toString();
    if (data.stack && data.message) {
        outData += "\n\n" + data.stack;
    }
    return render(ERROR_TEMPLATE,
        { code: code, message: message, data: outData, here: new URL(req.url, "https://" + req.headers.host).href }
    );
}

export function generateErrorObject(code, message, error) {
    return { code: 500, message: "Generating oembed failed", error: error.toString(), errorInfo: error.stack };
}

export function sendTemplate(res, file, data, errorMessage, req) {
    renderFile(join(process.cwd(), file), data)
    .catch(function (err) {
        res
            .status(500)
            .send(generateError(500, errorMessage, err, req));
    })
    .then(out => res.send(out));
}

export function sendOembed(data, res, isXML) {
    try {
        res.json(data);
    } catch (e) {
        res.status(500).json(generateErrorObject(500, "Generating oembed failed", e));
    }
}
