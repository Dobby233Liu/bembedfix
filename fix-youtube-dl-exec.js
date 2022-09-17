/*
  Copyright © 2021 microlink.io <hello@microlink.io> (microlink.io)
  Copyright © 2022 Liu Wenyuan

  Permission is hereby granted, free of charge, to any person obtaining
  a copy of this software and associated documentation files (the "Software"),
  to deal in the Software without restriction, including without limitation
  the rights to use, copy, modify, merge, publish, distribute, sublicense,
  and/or sell copies of the Software, and to permit persons to whom the
  Software is furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR
  ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import _youtubedl from "youtube-dl-exec";
import isUnix from "is-unix";
import { execa } from "execa";

const PYTHON_EXECUTABLE = "python3.9";

let youtubedl = _youtubedl;

const args = youtubedl.args;
const isJSON = youtubedl.isJSON;
const constants = youtubedl.constants;

const _create = youtubedl.create;
function createFixed(binaryPath) {
    // const fn = (url, flags, opts) => fn.exec(url, flags, opts).then(parse);
    const fn = _create(binaryPath);
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
