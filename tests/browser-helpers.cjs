exports.fillBackground=async function(p){
 const role=new URL(p.url()).searchParams.get('role');
 const legal=['judge','lawyer'].includes(role);
 await p.locator(`[name=legalIndustry][value=${legal?'yes':'no'}]`).check();
 if(legal)await p.locator(`[name=legalOccupation][value=${role}]`).check();
 else{await p.locator('[name=judgeCaseExperience][value=no]').check();await p.locator('[name=litigationExperience][value=no]').check();}
 await p.locator('[name=legalDegree][value=no]').check();
};
