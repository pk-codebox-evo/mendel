const verbose = require('debug')('verbose:mendel:generator:prune');

// First argument is not needed; just to make it look like normal generator API
function pruneModules(bundle, doneBundles, registry, generator) {
    const {groups} = generator.options;
    groups.forEach(group => {
        const bundles = group.map(bundleId => {
            return doneBundles.find(b => b.id === bundleId);
        }).filter(Boolean);
        pruneGroup(bundles);
    });
}

function pruneGroup(bundles) {
    const getUniqId = (function() {
        let index = 0;
        return () => '_u' + Number(index++).toString(16);
    })();

    const exposeNormToExposeId = new Map();
    const allNorms = new Set();

    bundles.forEach(({entries}) => {
        entries.forEach(entry => {
            const norm = entry.normalizedId;
            allNorms.add(norm);

            if (entry.expose && !exposeNormToExposeId.has(entry.expose))
                exposeNormToExposeId.set(entry.expose, getUniqId());
        });
    });

    bundles.forEach(({entries}) => {
        Array.from(entries.entries()).forEach(([key, entry]) => {
            const clone = Object.assign({}, entry);
            clone.deps = JSON.parse(JSON.stringify(entry.deps));
            entries.set(key, clone);

            // Prune dependencies
            Object.keys(clone.deps).forEach(literal => {
                const deps = clone.deps[literal];

                const remove = Object.keys(deps).every(runtime => {
                    const dep = deps[runtime];
                    return !allNorms.has(dep);
                });

                if (remove) {
                    verbose(
                        '[WARN][generator-prune] Removing ',
                        literal,
                        'from',
                        entry.id
                    );
                    delete clone.deps[literal];
                }
            });

            // Remap externals
            if (exposeNormToExposeId.has(entry.expose))
                clone.expose = exposeNormToExposeId.get(entry.expose);
            Object.keys(clone.deps).forEach(literal => {
                const deps = clone.deps[literal];
                Object.keys(deps).forEach(runtime => {
                    const dep = deps[runtime];
                    if (exposeNormToExposeId.has(dep)) {
                        deps[runtime] = exposeNormToExposeId.get(dep);
                    }
                });
            });
        });
    });
}

module.exports = pruneModules;
