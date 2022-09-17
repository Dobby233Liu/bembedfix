import youtubedl from "youtube-dl-exec";
import isUnix from "is-unix";
import execa from "execa";

const PYTHON_EXECUTABLE = "python3.9";

const args = youtubedl.args;
const isJSON = youtubedl.isJSON;
const constants = youtubedl.constants;

const _create = youtubedl.create;
function createFixed(binaryPath) {
    const fn = (url, flags, opts) => fn.exec(url, flags, opts).then(parse);
    // Call the actual python interpreter
    fn.exec = (url, flags, opts) => execa(PYTHON_EXECUTABLE, [binaryPath].concat(args(url, flags)), opts);
    return fn;
}

// Workaround for ytdlexec not functioning
// in Vercel
// TODO: shouldn't do this in dev

if (isUnix(process.platform)) {
    youtubedl = createFixed(constants.YOUTUBE_DL_PATH);
    youtubedl.create = createFixed;
    youtubedl.args = args;
    youtubedl.isJSON = isJSON;
    youtubedl.constants = constants;
}

export default youtubedl;
