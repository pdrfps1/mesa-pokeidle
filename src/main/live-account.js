function registerLiveAccount(deps) {
  const { ipcMain, session, catalog, isUi } = deps;
  const fromUi = (event) => typeof isUi === 'function' && isUi(event);

  ipcMain.handle('bay:reset', async (event, index) => {
    if (!fromUi(event)) return false;
    const bay = Number(index);
    if (!Number.isInteger(bay) || bay < 0 || bay >= catalog.partitions.length) return false;
    const ses = session.fromPartition(catalog.partitions[bay]);
    await ses.clearStorageData();
    await ses.clearCache();
    try { await ses.clearAuthCache(); } catch { /* sem cache de autenticação */ }
    return true;
  });
}

module.exports = { registerLiveAccount };
