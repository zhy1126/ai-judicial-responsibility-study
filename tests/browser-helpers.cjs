exports.fillBackground=async function(p){
 const role=new URL(p.url()).searchParams.get('role');
 const choice=['judge','lawyer'].includes(role)?role:'other';
 await p.locator(`[name=backgroundChoice][value=${choice}]`).check();
};
