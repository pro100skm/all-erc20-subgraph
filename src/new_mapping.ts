import {
  Transfer as TransferEvent,
  Approval as ApprovalEvent, ERC20,
} from '../generated/ERC20/ERC20'

import {
  constants
} from '@amxx/graphprotocol-utils'

import {
  Address,
} from '@graphprotocol/graph-ts'

import {
  Account,
  ERC20Contract,
  ERC20Balance,
  ERC20Approval, ERC20Transfer, Transaction,
} from '../generated/schema'


export function fetchERC20(address: Address): ERC20Contract {
  let contract = ERC20Contract.load(address.toHex())

  if (contract == null) {
    let endpoint         = ERC20.bind(address)
    let name             = endpoint.try_name()
    let symbol           = endpoint.try_symbol()

    // Common
    contract             = new ERC20Contract(address.toHex())
    contract.name        = name.reverted     ? null : name.value
    contract.symbol      = symbol.reverted   ? null : symbol.value
    contract.decimals    =  18
    contract.totalSupply = fetchERC20Balance(contract as ERC20Contract, null).id
    contract.asAccount   = address.toHex()
    contract.save()

    let account          = fetchAccount(address)
    account.asERC20      = address.toHex()
    account.save()
  }

  return contract as ERC20Contract
}

export function fetchERC20Balance(contract: ERC20Contract, account: Account | null): ERC20Balance {
  let id      = contract.id.concat('/').concat(account ? account.id : 'totalSupply')
  let balance = ERC20Balance.load(id)

  if (balance == null) {
    balance                 = new ERC20Balance(id)
    balance.contract        = contract.id
    balance.account         = account ? account.id : null
    balance.value           = constants.BIGDECIMAL_ZERO
    balance.valueExact      = constants.BIGINT_ZERO
    balance.save()
  }

  return balance as ERC20Balance
}

export function fetchERC20Approval(contract: ERC20Contract, owner: Account, spender: Account): ERC20Approval {
  let id       = contract.id.concat('/').concat(owner.id).concat('/').concat(spender.id)
  let approval = ERC20Approval.load(id)

  if (approval == null) {
    approval                = new ERC20Approval(id)
    approval.contract       = contract.id
    approval.owner          = owner.id
    approval.spender        = spender.id
    approval.value          = constants.BIGDECIMAL_ZERO
    approval.valueExact     = constants.BIGINT_ZERO
  }

  return approval as ERC20Approval
}


export function fetchAccount(address: Address): Account {
  let account = new Account(address.toHex())
  account.save()
  return account
}




export function handleTransfer(event: TransferEvent): void {
  let contract   = fetchERC20(event.address)
  let ev         = new ERC20Transfer(event.block.number.toString().concat('-').concat(event.logIndex.toString()))
  ev.emitter     = contract.id
  ev.transaction = event.transaction.hash.toHex()
  ev.timestamp   = event.block.timestamp
  ev.block = event.block.number.toI32()
  ev.contract    = contract.id
  ev.value       = event.params.value.toBigDecimal()
  ev.valueExact  = event.params.value

  if (event.params.from.toHex() == constants.ADDRESS_ZERO.toHex()) {
    let totalSupply        = fetchERC20Balance(contract, null)
    totalSupply.valueExact = totalSupply.valueExact.plus(event.params.value)
    totalSupply.value      = totalSupply.valueExact.toBigDecimal()
    totalSupply.save()
  } else {
    let from               = fetchAccount(event.params.from)
    let balance            = fetchERC20Balance(contract, from)
    balance.valueExact     = balance.valueExact.minus(event.params.value)
    balance.value          = balance.valueExact.toBigDecimal()
    balance.save()

    ev.from                = from.id
    ev.fromBalance         = balance.id
  }

  if (event.params.to.toHex() == constants.ADDRESS_ZERO.toHex()) {
    let totalSupply        = fetchERC20Balance(contract, null)
    totalSupply.valueExact = totalSupply.valueExact.minus(event.params.value)
    totalSupply.value      = totalSupply.valueExact.toBigDecimal()
    totalSupply.save()
  } else {
    let to                 = fetchAccount(event.params.to)
    let balance            = fetchERC20Balance(contract, to)
    balance.valueExact     = balance.valueExact.plus(event.params.value)
    balance.value          = balance.valueExact.toBigDecimal()
    balance.save()

    ev.to                  = to.id
    ev.toBalance           = balance.id
  }

  ev.save()
}

export function handleApproval(event: ApprovalEvent): void {
  let contract = fetchERC20(event.address)

  let owner           = fetchAccount(event.params.owner)
  let spender         = fetchAccount(event.params.spender)
  let approval        = fetchERC20Approval(contract, owner, spender)
  approval.valueExact = event.params.value
  approval.value      = event.params.value.toBigDecimal()
  approval.save()

  // let ev         = new ERC20ApprovalEvent(events.id(event))
  // ev.emitter     = contract.id
  // ev.transaction = transactions.log(event).id
  // ev.timestamp   = event.block.timestamp
  // ev.token       = token.id
  // ev.owner       = owner.id
  // ev.spender     = spender.id
  // ev.approval    = approval.id
  // ev.value       = value.value
  // ev.save()
}
