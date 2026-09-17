/******************************************************************************/
/*!
\group  	CtrlAlt
\file		SLogic.h
\author 	Sherman Goh Wee Hao
\par    	shermanweehao.goh@digipen.edu
\date   	Oct 19, 2024 [week 8]
\date   	Nov 22, 2024 [week 12] Revamp for C#.

\brief		This is SLogic to attach Entities to their MonoScript Instances 
			and help Entities run their Logic in the game update loop,
			which is to call C# Methods via unmanaged thunks.

			reference
			https://buildagameengine.com/scripting/scripts-and-components-mono
\par
		Cannot complete description/documentation in time ,
		Can look into M2 Rubrics for some explanation.

		=========
		M3 Update
		=========

		errr looks like abunch of wrapper/execution areas.
		As much of the internals occurs in CScriptMono

		SLogic accompany GSM well -- I would say.

		[M4]
		Added in the FixedUpdate, 
		-poor implementation-


Copyright (C) 2024 DigiPen Institute of Technology.
Reproduction or disclosure of this file or its contents without the
prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/

#ifndef SLOGIC_H
#define SLOGIC_H

#include "../Components/Components.h"
#include "../ECS/ECS.h"
#include "../Logic/Logics.h"
#include "../Input/Input.h"
#include "../Scripting/EngineMonoScript.h"

namespace System
{
	class SLogic : public ECS::System
	{
	private:
		

		// for m_behaviourKey and BehaviourComponent.
		//std::vector<ECS::Entity> m_entities; // in ECS::System under SystemEntities
		EngineMonoScript* scriptEngine; 

	public:
		SLogic(EngineMonoScript*  _scriptEngine);

		void Setup(); // w engine 
		void Init(); // w game simulation
		void Update();
		void FixedUpdate(); // current implementation is after all of Update is called.
		void Free(); // w game simulation
		void Exit(); // w engine


		~SLogic(); //?
	}; // end of class SLogic.

}// end of namespace

#endif // of SLOGIC_H header guard

