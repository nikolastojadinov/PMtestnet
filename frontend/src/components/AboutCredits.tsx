import React from "react";

export default function AboutCredits() {
  return (
    <div className="p-6 text-sm text-gray-300 leading-relaxed">
      <h1 className="text-xl font-semibold text-purple-400 mb-4">About / Credits</h1>
      <p>
        <strong>Purple Music</strong> is based in part on <strong>OKV-Music</strong> (© onamkrverma).
      </p>
      <p className="mt-2">
        Licensed under the <strong>Mozilla Public License 2.0 (MPL-2.0)</strong>.
      </p>
      <p className="mt-4">Modifications © 2025 Purple Music Team.</p>
      <p className="mt-4">
        Original project: {" "}
        <a
          href="https://github.com/onamkrverma/okv-music"
          target="_blank"
          rel="noreferrer"
          className="text-purple-300 underline"
        >
          OKV-Music Repository
        </a>
      </p>
      <p className="mt-6 text-xs text-gray-400">
        For full license text, see the LICENSE file at the project root.
      </p>
    </div>
  );
}
