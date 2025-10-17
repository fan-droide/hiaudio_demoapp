import { ENDPOINT } from '../../../../common/js/config'
import DynamicModal from '../../../../common/js/modaldialog'
import { looksLikeMail } from '../../../../common/js/utils'
import {updateSettings} from '../settings'
import {CURRENT_USER_ID} from '../composition_helper'

let CURRENT_CONTRIBUTORS = []
let NEW_CONTRIBUTORS = []
let TOREMOVE_CONTRIBUTORS = []

export const ROLES = {1:'Owner', 2:'Admin', 3:'Member', 4:'Guest'}

export const getCurrentContributors = () => {
    return CURRENT_CONTRIBUTORS
}

export const clearUIContributors = () => {
    document.getElementById('contributorinput').value = ''
    const ul = document.getElementById('listOfContributors')
    ul.innerHTML = ''  
}

export const clearAuxContribArrays = () => {
    NEW_CONTRIBUTORS = []
    TOREMOVE_CONTRIBUTORS = []
}

export const setUIContributors = (contributors) => {
   
    const ul = document.getElementById('listOfContributors')

    if (contributors.length) {
        CURRENT_CONTRIBUTORS = contributors
        contributors.flatMap((elem) => addContributorToUI(ul, elem))
    } else {        
        document.getElementById('contributorinput').value = ''
        ul.innerHTML = ''
    }
}

export const addContributorButtonHandler = (compositionId, compUserId) => {

    const button = document.getElementById('addContribButton')
    const input = document.getElementById('contributorinput')
    const ul = document.getElementById('listOfContributors')

    button.addEventListener('click', function () {
        const roleInput = document.getElementById('inputGroupSelectRole')
        const role = roleInput.value
        document.getElementById('contributorinput').classList.remove('is-invalid')     
        document.getElementById('validationemailresult').innerText = ''        
        if (input.value && looksLikeMail(input.value)) {           
            addContributorToList(ul, input.value.trim(), compositionId, role, compUserId)
        } else {
            document.getElementById('contributorinput').classList.add('is-invalid')     
            document.getElementById('validationemailresult').innerText = 'Sorry, invalid email address format.'
        }
    })
}

const addContributorToUI = (ul, contrib, uid) => {
    const role = ROLES[contrib.role]
    const li = document.createElement('li')
    li.className = 'list-group-item'
    li.id = uid || contrib.user_uid
    li.textContent = contrib.email + ' (' + role + ')'    
    const deleteSwitch = `&nbsp;<div class='custom-control custom-switch custom-control-inline float-right'>
    <input type='checkbox' class='custom-control-input is-invalid' id='removeContSwitch${contrib.user_uid}'>
    <label class='custom-control-label is-invalid' for='removeContSwitch${contrib.user_uid}'>Remove</label>
  </div>`
    li.innerHTML += deleteSwitch
    ul.appendChild(li)
    removeContributorSwitchHandler(contrib)
}

const addContributorToList = async (ul, contrib, compositionId, role, compUserId) => {
    const roleInput = document.getElementById('inputGroupSelectRole').value    
    if(parseInt(roleInput) !== 0){
        
        const newcontrib = { email:contrib, user_uid: contrib, composition_id: compositionId, role: parseInt(role) }        
        const indexContribDuplicateInCurrent = CURRENT_CONTRIBUTORS.findIndex(x => x.email === contrib)
        const indexContribDuplicateInNew = NEW_CONTRIBUTORS.findIndex(x => x.email === contrib)
        const indexToRemove = TOREMOVE_CONTRIBUTORS.indexOf(contrib)
        if(indexToRemove > -1){
            TOREMOVE_CONTRIBUTORS.splice(indexToRemove,1)
        }
        let canAdd = false

        if((indexContribDuplicateInNew < 0) && (indexContribDuplicateInCurrent < 0)){
            canAdd = true
        } else {
            canAdd = checkDuplicateBeforeAdding(newcontrib, indexContribDuplicateInNew, indexContribDuplicateInCurrent, ul)    
        }        
        
        if(canAdd){
            // #TODO: replace with API call to new endpoint to validate contributor
            const response = await fetch(ENDPOINT + '/checkuser/' + contrib)
            if((response?.ok || (response?.status === 404))){
                const respJson = await response.json()
                if(compUserId !== respJson.user_uid){
                    if(response?.status === 200){
                        newcontrib.user_uid = respJson.user_uid
                    }                                                        
                    NEW_CONTRIBUTORS.push(newcontrib)            
                    addContributorToUI(ul, newcontrib)
                    if(response?.status === 404){
                        displayModalDialog('An invitation via email will be sent to: '+ contrib + ', after clicking on the button Confirm')
                    }
                } else {
                    displayModalDialog(`Can't add ${contrib} as contributor`)
                }
            } else {
                displayModalDialog(`${contrib} can't be added`)
            }
        } else {
            displayModalDialog(`${contrib} can't be updated`)
        }
    } else {
        displayModalDialog(`Choose a role, please`)
    }   
}

const displayModalDialog = (message) => {
    DynamicModal.dynamicModalDialog(
        message,
        null,
        '',
        'Close',
        'Warning!',
        'bg-warning'
      )
}

const checkDuplicateBeforeAdding = (newcontrib, atIndexNew, atIndexCurrent, ul) => {
    
    let canAdd = false
    const uid = CURRENT_CONTRIBUTORS[atIndexCurrent]?.user_uid || NEW_CONTRIBUTORS[atIndexNew]?.user_uid
    const contribListElem = document.getElementById(uid)
    if(contribListElem){
        if(atIndexCurrent >= 0 && atIndexNew < 0){
            const isTheSameAsCurrentUser = CURRENT_USER_ID === CURRENT_CONTRIBUTORS[atIndexCurrent].user_uid
            const sameContributorSameRole = (CURRENT_CONTRIBUTORS[atIndexCurrent].email === newcontrib.email) && (CURRENT_CONTRIBUTORS[atIndexCurrent].role === newcontrib.role)
            if(!isTheSameAsCurrentUser && !sameContributorSameRole){
                canAdd = true
                contribListElem.remove()  
            }
        } 
        if(atIndexNew >= 0 && atIndexCurrent < 0){
            if(NEW_CONTRIBUTORS[atIndexNew].role !== newcontrib.role){
                canAdd = true
                NEW_CONTRIBUTORS.splice(atIndexNew,1)
                contribListElem.remove()  
            } 
        }
        if(atIndexNew >= 0 && atIndexCurrent >= 0){
            if(CURRENT_CONTRIBUTORS[atIndexCurrent].role === newcontrib.role){
                NEW_CONTRIBUTORS.splice(atIndexNew,1)
                contribListElem.remove()                
                addContributorToUI(ul, newcontrib, uid)
            } 
            if(NEW_CONTRIBUTORS.length && (NEW_CONTRIBUTORS[atIndexNew].role !== newcontrib.role)){
                canAdd = true
                NEW_CONTRIBUTORS.splice(atIndexNew,1)
                contribListElem.remove() 
            }
        }              
    }
    return canAdd
}

export const saveNewContributors = async () => {
    if(NEW_CONTRIBUTORS.length > 0){
        let copy_new_contribs = [...NEW_CONTRIBUTORS]
        let errorContribsAdd = 0
        for (let i=0; i < NEW_CONTRIBUTORS.length; i++){
            const newcontrib = NEW_CONTRIBUTORS[i]
            const resultAddContrib = await updateSettings('POST', '/addcontributorbyemail', newcontrib)                    
            if(resultAddContrib?.ok){
                NEW_CONTRIBUTORS[i].id = resultAddContrib.contribid                
                if(newcontrib.email === newcontrib.user_uid){
                    NEW_CONTRIBUTORS[i].user_uid = resultAddContrib.uuid
                    document.getElementById(newcontrib.email).id = resultAddContrib.uuid                    
                }
                copy_new_contribs[i] = null                       
            } else {
                errorContribsAdd++
            }                       
        }
        if(errorContribsAdd > 0){
            NEW_CONTRIBUTORS.splice(errorContribsAdd - NEW_CONTRIBUTORS.length)
            const errorMessage = `${errorContribsAdd} contributor/s can't be added`
            handleErrorContribs(errorMessage)
        } else {
            const noEmptyNewValues = copy_new_contribs.filter((value) => value != null)
            for (let i=0; i < NEW_CONTRIBUTORS.length; i++){ 
                const indexContributorDuplicated = CURRENT_CONTRIBUTORS.findIndex(x => x.email === NEW_CONTRIBUTORS[i].email)
                if(indexContributorDuplicated > -1){
                    CURRENT_CONTRIBUTORS[indexContributorDuplicated].role = NEW_CONTRIBUTORS[i].role
                    NEW_CONTRIBUTORS.splice(i, 1)
                }
            }
            CURRENT_CONTRIBUTORS = CURRENT_CONTRIBUTORS.concat(NEW_CONTRIBUTORS)
            document.getElementById('contributorinput').value = ''
            NEW_CONTRIBUTORS = noEmptyNewValues
        }
    }   
}

const handleErrorContribs = (errorMessage) => {
    clearUIContributors()     
    setUIContributors(getCurrentContributors())
    DynamicModal.dynamicModalDialog(
        errorMessage, 
        null, 
        '',
        'Close',
        'Error',
        'bg-danger'
    )
}

export const saveRemoveContributors = async (compId) => {
    if(TOREMOVE_CONTRIBUTORS.length > 0){
        let copy_toremove_contribs = [...TOREMOVE_CONTRIBUTORS]
        let errorContribsRemove = 0
        for (let j=0; j < TOREMOVE_CONTRIBUTORS.length; j++){ 
            const indexContribInCurrent = CURRENT_CONTRIBUTORS.findIndex(x => x.email === TOREMOVE_CONTRIBUTORS[j])                              
            const contribToRemId = CURRENT_CONTRIBUTORS[indexContribInCurrent]?.user_uid 
            const contribToRem = {contrib_uuid:contribToRemId, comp_uuid:compId}
            const resultRemoveContrib = await updateSettings('DELETE', '/deletecontributor', contribToRem)                    
            if(resultRemoveContrib?.ok){                        
                copy_toremove_contribs[j] = null
                CURRENT_CONTRIBUTORS.splice(indexContribInCurrent,1)
                document.getElementById(contribToRemId).remove()
            } else {
                errorContribsRemove++
            }                   
        }
        if(errorContribsRemove > 0){
            TOREMOVE_CONTRIBUTORS.splice(errorContribsRemove - TOREMOVE_CONTRIBUTORS.length)
            const errorMessage = `${errorContribsRemove} contributor/s can't be removed`
            handleErrorContribs(errorMessage)
        } else {
            const noEmptyValuesRm = copy_toremove_contribs.filter((value) => value != null)
            TOREMOVE_CONTRIBUTORS = noEmptyValuesRm
        }
    }         
}

const removeContributorSwitchHandler = (contrib) => {
    
    document.getElementById('removeContSwitch'+contrib.user_uid).addEventListener('change', function(event) {        
        const chk = event.target
        if (chk.tagName === 'INPUT' && chk.type === 'checkbox') {
            if(chk.checked){
                DynamicModal.dynamicModalDialog(
                    `Do you want remove the contributor: ${contrib.email}?`,
                    'btn-delete-contributor',
                    'OK',
                    'Cancel',
                    'Delete Contributor',
                    'bg-warning',
                    () => {
                        chk.checked = false
                    }
                )
                document.getElementById('btn-delete-contributor').onclick = async () => {
                    const indexContribInNew = NEW_CONTRIBUTORS.findIndex(x => x.email === contrib.email)
                    if(indexContribInNew > -1){
                        NEW_CONTRIBUTORS.splice(indexContribInNew,1)
                        const indexContribInCurrent = CURRENT_CONTRIBUTORS.findIndex(x => x.email === contrib.email)
                        if(indexContribInCurrent === -1){
                            document.getElementById(contrib.user_uid).remove()
                        } else {
                            TOREMOVE_CONTRIBUTORS.push(contrib.email)
                        }
                    } else {
                        TOREMOVE_CONTRIBUTORS.push(contrib.email)
                    }
                    DynamicModal.closeDynamicModal(()=>{
                        chk.checked = true
                    })
                }
            } else {
                const indexToRemove = TOREMOVE_CONTRIBUTORS.indexOf(contrib.email)
                if(indexToRemove > -1){
                    TOREMOVE_CONTRIBUTORS.splice(indexToRemove,1)
                }
            }
        }
    })
}

export const updateContributorsAtCompPage = () => {

    const contributorsbadgetext = document.getElementById('contributorsbadgetext')
    if(contributorsbadgetext || CURRENT_CONTRIBUTORS.length){
        const rolebadgetext = document.getElementById('rolebadgetext')        
        if(!contributorsbadgetext){            
            if(rolebadgetext){                
                const badgeHtml = `&nbsp;<span class="badge badge-light">COLLABORATORS:&nbsp;</span><span id="contributorsbadgetext" class="badge badge-dark">${CURRENT_CONTRIBUTORS.length}</span>`
                rolebadgetext.insertAdjacentHTML('afterend', badgeHtml)
            }
        } else {
            if(CURRENT_CONTRIBUTORS.length !== parseInt(contributorsbadgetext.innerText)){
                if(CURRENT_CONTRIBUTORS.length){
                    contributorsbadgetext.innerText = CURRENT_CONTRIBUTORS.length
                } else {
                    const contributorLabelBadge = contributorsbadgetext.previousSibling.previousSibling
                    const contributorNumberBadge = contributorsbadgetext.previousSibling
                    contributorLabelBadge.remove()
                    contributorNumberBadge.remove()
                    contributorsbadgetext.remove()
                }
            }
        }
    }
}
