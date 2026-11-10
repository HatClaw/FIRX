import { VendorVisitRepository } from '@/repositories/vendor-visit-repository';
import type { CreateVendorVisit, VendorVisitStatus } from '@/lib/vendor-visit-types';

export class VendorVisitService {
  static listForCompany(empresaId: string, role: string) {
    if (!['admin', 'gestor'].includes(role)) throw new Error('Apenas administradores podem acompanhar visitas da equipe.');
    return VendorVisitRepository.listForCompany(empresaId);
  }

  static listForSeller(vendedorId: string) {
    return VendorVisitRepository.listForSeller(vendedorId);
  }

  static create(visit: CreateVendorVisit, role: string) {
    if (role !== 'admin') throw new Error('Apenas o administrador da empresa pode enviar visitas.');
    return VendorVisitRepository.create(visit);
  }

  static updateStatus(id: string, status: VendorVisitStatus) {
    return VendorVisitRepository.updateStatus(id, status);
  }

  static updateLocation(id: string, latitude: number, longitude: number) {
    return VendorVisitRepository.updateLocation(id, latitude, longitude);
  }
}
