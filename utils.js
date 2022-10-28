import { render, renderFile } from "ejs";
import { join } from "path";
import { ERROR_TEMPLATE, PROJECT_ISSUES_URL } from "./conf.js";
import { Builder as XMLBuilder } from "xml2js";

export function generateError(code, message, data, req) {
    return render(ERROR_TEMPLATE,
        {
            code: code,
            message: message,
            data: data.stack ? data.stack : data.toString(),
            here: new URL(req.url, "https://" + req.headers.host).href,
            issues_url: PROJECT_ISSUES_URL
        }
    );
}

/*export function generateErrorObject(code, message, error) {
    return { code: 500, message: message, error: error.toString(), errorInfo: error.stack };
}*/

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
    res.send(new XMLBuilder().buildObject({ oembed: data }));
}

export function checkIfUrlIsUnderDomain(l, r) {
    let levelsOfDomainLeft = l.split(".");
    let levelsOfDomainRight = r.split(".");
    if (levelsOfDomainLeft.length < levelsOfDomainRight.length)
        return false;
    return levelsOfDomainLeft
        .slice(-levelsOfDomainRight.length)
        .every((level, index) => level == levelsOfDomainRight[index]);
}
