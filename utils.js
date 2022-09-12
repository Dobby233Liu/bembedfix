import { render, renderFile } from "ejs";
import { join } from "path";
import { ERROR_TEMPLATE } from "./conf.js";
import { Builder as XMLBuilder } from "xml2js";

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
    if (!isXML) {
        res.json(data);
        return;
    }

    res.setHeader("Content-Type", "text/xml");
    var builder = new XMLBuilder();
    var xml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
${builder.buildObject({ oembed: data });}`;
    /*} catch (e) {
        res.status(500).json(generateErrorObject(500, "Generating oembed failed", e));
    }*/
    res.send(xml);
}
